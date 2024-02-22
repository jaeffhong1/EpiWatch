import os
import sys

import fire
import gc
import gradio as gr
import torch
import transformers
from peft import PeftModel
from transformers import GenerationConfig, LlamaForCausalLM, LlamaTokenizer

from utils.callbacks import Iteratorize, Stream
from utils.prompter import Prompter

if torch.cuda.is_available():
    print("using gpu")
    device = "cuda"
else:
    print("using cpu")
    device = "cpu"

try:
    if torch.backends.mps.is_available():
        device = "mps"
except:  # noqa: E722
    pass

loaded_model = {}
model_dict = {}

def get_gpu_memory_status():
    # Returns a tuple of (allocated, free, total) memory in MBs for the first cuda device.
    device = torch.cuda.current_device()
    allocated = round(torch.cuda.memory_allocated(device) / 1024 ** 2, 1)
    cached = round(torch.cuda.memory_reserved(device) / 1024 ** 2, 1)
    return allocated, cached

def main(
    load_8bit: bool = False,
    base_models: str = "",
    lora_weights: str = "tloen/alpaca-lora-7b",
    prompt_template: str = "",  # The prompt template to use, will default to alpaca.
    server_name: str = "0.0.0.0",  # Allows to listen on all interfaces by providing '0.
    share_gradio: bool = False,
):
    print("STARTING :", get_gpu_memory_status())
    prompter = Prompter(prompt_template)
    base_models = base_models.split(',')
    lora_weights = lora_weights.split(',')

    for idx, base_model in enumerate(base_models):
        model_dict[base_model] = idx

    def unload_model(model_to_unload):
        print("Before unloading model:", get_gpu_memory_status())
        del model_to_unload
        gc.collect()
        torch.cuda.empty_cache()
        print("After unloading model:", get_gpu_memory_status())

    def load_model(model_to_load, weights_to_load):
        print(model_to_load)
        assert (
            model_to_load
        ), "Please specify a --base_model, e.g. --base_model='huggyllama/llama-7b'"

        tokenizer = LlamaTokenizer.from_pretrained(model_to_load)
        if device == "cuda":
            model = LlamaForCausalLM.from_pretrained(
                model_to_load,
                load_in_8bit=load_8bit,
                torch_dtype=torch.float16,
                device_map="auto",
            )
            print("Model device:", next(model.parameters()).device)
            model = PeftModel.from_pretrained(
                model,
                weights_to_load,
                torch_dtype=torch.float16,
            )
            print("Model device:", next(model.parameters()).device)
        elif device == "mps":
            model = LlamaForCausalLM.from_pretrained(
                model_to_load,
                device_map={"": device},
                torch_dtype=torch.float16,
            )
            model = PeftModel.from_pretrained(
                model,
                weights_to_load,
                device_map={"": device},
                torch_dtype=torch.float16,
            )
        else:
            model = LlamaForCausalLM.from_pretrained(
                model_to_load, device_map={"": device}, low_cpu_mem_usage=True
            )
            model = PeftModel.from_pretrained(
                model,
                weights_to_load,
                device_map={"": device},
            )

        # unwind broken decapoda-research config
        model.config.pad_token_id = tokenizer.pad_token_id = 0  # unk
        model.config.bos_token_id = 1
        model.config.eos_token_id = 2

        if not load_8bit:
            model.half()  # seems to fix bugs for some users.
        model.eval()
        if torch.__version__ >= "2" and sys.platform != "win32":
            model = torch.compile(model)

        print("Model device:", next(model.parameters()).device)
        return (model, tokenizer)

    global loaded_model
    loaded_model[base_models[0]] = load_model(base_models[0], lora_weights[model_dict[base_models[0]]])
    def evaluate(
        selected_model,
        instruction,
        input=None,
        temperature=0.1,
        top_p=0.75,
        top_k=40,
        num_beams=4,
        max_new_tokens=128,
        stream_output=True,
        **kwargs,
    ):
        global loaded_model
        loaded_model_name = list(loaded_model.keys())[0]
        if (selected_model not in loaded_model):
            #unload_model(loaded_model[loaded_model_name][0])
            model, tokenizer = load_model(selected_model, lora_weights[model_dict[selected_model]])
            loaded_model[selected_model] = (model, tokenizer)
        else:
            model, tokenizer = loaded_model[selected_model][0], loaded_model[selected_model][1]
        

        prompt = prompter.generate_prompt(instruction, input)
        inputs = tokenizer(prompt, return_tensors="pt")
        input_ids = inputs["input_ids"].to(device)
        generation_config = GenerationConfig(
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            num_beams=num_beams,
            **kwargs,
        )

        generate_params = {
            "input_ids": input_ids,
            "generation_config": generation_config,
            "return_dict_in_generate": True,
            "output_scores": True,
            "max_new_tokens": max_new_tokens,
        }

        if stream_output:
            # Stream the reply 1 token at a time.
            # This is based on the trick of using 'stopping_criteria' to create an iterator,
            # from https://github.com/oobabooga/text-generation-webui/blob/ad37f396fc8bcbab90e11ecf17c56c97bfbd4a9c/modules/text_generation.py#L216-L243.

            def generate_with_callback(callback=None, **kwargs):
                kwargs.setdefault(
                    "stopping_criteria", transformers.StoppingCriteriaList()
                )
                kwargs["stopping_criteria"].append(
                    Stream(callback_func=callback)
                )
                with torch.no_grad():
                    model.generate(**kwargs)

            def generate_with_streaming(**kwargs):
                return Iteratorize(
                    generate_with_callback, kwargs, callback=None
                )

            with generate_with_streaming(**generate_params) as generator:
                for output in generator:
                    # new_tokens = len(output) - len(input_ids[0])
                    decoded_output = tokenizer.decode(output)

                    if output[-1] in [tokenizer.eos_token_id]:
                        break

                    yield prompter.get_response(decoded_output)
            return  # early return for stream_output

        # Without streaming
        with torch.no_grad():
            generation_output = model.generate(
                input_ids=input_ids,
                generation_config=generation_config,
                return_dict_in_generate=True,
                output_scores=True,
                max_new_tokens=max_new_tokens,
            )
        s = generation_output.sequences[0]
        output = tokenizer.decode(s)
        yield prompter.get_response(output)

    gr.Interface(
        fn=evaluate,
        inputs=[
            gr.components.Dropdown(
                choices=list(model_dict.keys()), label="Select Model"
            ), 
            gr.components.Textbox(
                lines=2,
                label="Instruction",
                placeholder="Tell me about alpacas."
            ),
            gr.components.Textbox(lines=2, label="Input", placeholder="none"),
            gr.components.Slider(
                minimum=0, maximum=1, value=0.1, label="Temperature"
            ),
            gr.components.Slider(
                minimum=0, maximum=1, value=0.75, label="Top p"
            ),
            gr.components.Slider(
                minimum=0, maximum=100, step=1, value=40, label="Top k"
            ),
            gr.components.Slider(
                minimum=1, maximum=4, step=1, value=4, label="Beams"
            ),
            gr.components.Slider(
                minimum=1, maximum=2000, step=1, value=128, label="Max tokens"
            ),
            gr.components.Checkbox(label="Stream output"),
        ],
        outputs=[
            gr.inputs.Textbox(
                lines=5,
                label="Output",
            )
        ],
        title="🦙🌲 Alpaca-LoRA",
        description="Alpaca-LoRA is a 7B-parameter LLaMA model finetuned to follow instructions. It is trained on the [Stanford Alpaca](https://github.com/tatsu-lab/stanford_alpaca) dataset and makes use of the Huggingface LLaMA implementation. For more information, please visit [the project's website](https://github.com/tloen/alpaca-lora).",  # noqa: E501
    ).queue().launch(server_name="0.0.0.0", share=share_gradio)
    # Old testing code follows.

    """
    # testing code for readme
    for instruction in [
        "Tell me about alpacas.",
        "Tell me about the president of Mexico in 2019.",
        "Tell me about the king of France in 2019.",
        "List all Canadian provinces in alphabetical order.",
        "Write a Python program that prints the first 10 Fibonacci numbers.",
        "Write a program that prints the numbers from 1 to 100. But for multiples of three print 'Fizz' instead of the number and for the multiples of five print 'Buzz'. For numbers which are multiples of both three and five print 'FizzBuzz'.",  # noqa: E501
        "Tell me five words that rhyme with 'shock'.",
        "Translate the sentence 'I have no mouth but I must scream' into Spanish.",
        "Count up from 1 to 500.",
    ]:
        print("Instruction:", instruction)
        print("Response:", evaluate(instruction))
        print()
    """


if __name__ == "__main__":
    fire.Fire(main)