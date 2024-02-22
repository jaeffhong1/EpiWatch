from flask import Flask, request, jsonify, stream_with_context, Response
from flask_cors import CORS
from new_multi import load_model, evaluate
import gc
import torch

app = Flask(__name__)
CORS(app)
base_models = {'StableBeluga-30': (0, '/home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B'), 'Yahma': (1, '/home/jaeff/comp4951/llama/alpaca-lora/llama-7b-hf'), 'StableBelugaBase': (2, '/home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B'), 'LlamaBase': (3, '/home/jaeff/comp4951/llama/alpaca-lora/Llama-2-13b-hf'), 'OpenOrca': (4, '/home/jaeff/comp4951/llama/alpaca-lora/OpenOrca-Platypus2-13B-Relation_v1'), 'Marcoroni': (5, '/home/jaeff/comp4951/llama/alpaca-lora/Marcoroni-13B-Relation_v1'), 'Camel': (6, '/home/jaeff/comp4951/llama/alpaca-lora/Camel-Platypus2-13B-Relation_v1'), 'Mythical': (7, '/home/jaeff/comp4951/llama/alpaca-lora/Mythical-Destroyer-V2-L2-13B-Relation_v1'), 'StableBeluga-135': (8, '/home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B'), 'Past-Yahma': (9, '/home/jaeff/comp4951/llama/alpaca-lora/llama-7b-hf'), 'StableBeluga-135-2': (10, '/home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B'), 'StableBeluga-135-best': (11, '/home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B')}
lora_weights = ['/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeffbest5_6_beluga/', '/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeffbest5_6_llama', '', '', '', '', '', '', '/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeff_try_synthetic_all_5val_3pochs_best3', '/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeff9epoch6', '/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeff_try_synthetic_all_5val_3pochs_2', '/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeff_try_synthetic_all_5val_3pochs_actualbest']

loaded_model = {}
init_model = 'OpenOrca'
loaded_model[init_model] = load_model(base_models[init_model][1], lora_weights[base_models[init_model][0]])

@app.route('/loadModel', methods=["PUT"])
def loadModel():
    model_name = request.values.get("modelname")
    loaded_model_name = list(loaded_model.keys())[0]

    curr_llama_model, curr_model, curr_tokenizer = (loaded_model[loaded_model_name][0]), (loaded_model[loaded_model_name][1]), (loaded_model[loaded_model_name][2])
    del curr_llama_model
    del curr_model
    del loaded_model[loaded_model_name]
    gc.collect()
    torch.cuda.empty_cache()

    llama_model, model, tokenizer = load_model(base_models[model_name][1], lora_weights[base_models[model_name][0]])
    loaded_model.clear()
    loaded_model[model_name] = (llama_model, model, tokenizer)

    return jsonify({"message": "Success"})

@app.route('/predictModel', methods=["GET"])
def predictModel():
    article = request.values.get("input")
    max_tokens = request.values.get("max_tokens")

    loaded_model_name = list(loaded_model.keys())[0]
    response_generator = evaluate(selected_model=loaded_model[loaded_model_name], input=article, max_new_tokens=int(max_tokens))
    
    return Response(stream_with_context(response_generator), content_type='text/plain')
    
if __name__ == '__main__':
    app.run(debug=False, port=8080)