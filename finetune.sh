#!/bin/bash

python3 /home/jaeff/comp4951/llama/alpaca-lora/alpaca-lora/finetune.py \
    --base_model /home/jaeff/comp4951/llama/alpaca-lora/StableBeluga-7B \
    --data_path modified_jaeff_synthetic_sorted_5_2.json \
    --output_dir ./jaeff_try_synthetic_all_5val_3pochs_actualbest2 \
    --batch_size 5 \
    --micro_batch_size 1 \
    --num_epochs 15 \
    --learning_rate 3e-4 \
    --cutoff_len 2048 \
    --val_set_size 0 \
    --lora_r 16 \
    --lora_target_modules '[q_proj,k_proj,v_proj,o_proj]' \
    --wandb_project 'llamaDOCRE' \
    --wandb_run_name 'jaeff_try_synthetic_all_5val_3pochs_actualbest2' \
    --wandb_watch 'false' \
    --wandb_log_model 'true' \