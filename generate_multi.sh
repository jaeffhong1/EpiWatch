#!/bin/bash
#export CUDA_VISIBLE_DEVICES=""

python3 /home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/test_multi.py \
    --base_models /home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B,/home/jaeff/comp4951/llama/alpaca-lora/llama-7b-hf \
    --lora_weights /home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeffbest5_6_beluga/,/home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/jaeffbest5_6_llama
