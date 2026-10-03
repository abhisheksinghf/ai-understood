# Chapter 22: inspect architecture mechanics

Requires Python 3.10+ and its standard library. Extract all four files into one folder. No package installation, account, GPU, network request, or pretrained model is needed. Use `python` or `python3` instead of `py` if appropriate.

```sh
py explore.py cnn
py explore.py cnn --poster cross --filter horizontal --stride 2 --padding 1
py explore.py sequence --history reversed --recurrent 0.5
py explore.py sequence --no-mask
py explore.py transfer --mode frozen
py explore.py transfer --mode finetune
py -m unittest -v test_explore.py
```

All three commands print JSON to stdout, without saving a model. Invalid arguments exit with code 2. `data.json` contains original, authored teaching inputs. They are not real movie images, viewing measurements, or pretrained parameters.

## 1. Poster filtering

`cnn` accepts `--poster edge|stripe|cross`, `--filter vertical|horizontal`, `--stride 1|2`, and `--padding 0|1`. Each poster is a 5 by 5 grayscale matrix. Values 0 and 1 represent dark and bright pixels. Kernels are 3 by 3, the bias is zero, and padding adds zeros on every side. The operation is cross-correlation: do not flip the kernel. Dilation is 1 and there is one input/output channel.

The report contains the raw output, ReLU activations, max pooling with a 2 by 2 window and stride 2, and a global average of the ReLU activations. Max pooling uses only complete windows and drops an incomplete right/bottom edge. `parameters: 10` means a normal one-filter layer has nine weights and one bias; those values are hand-set and are not optimized here.

The default raw output is three rows `[3, 3, 0]`. ReLU preserves it, max pooling returns `[[3]]`, and global average pooling is 2. `convolve()` supports other rectangular finite matrices for manual experiments. Its `padding` argument is symmetric per side.

## 2. Viewing histories

`sequence` accepts `--history original|reversed`, `--recurrent 0|0.5|1`, and `--no-mask`. Adventure is +1 and romance is -1; neither code says whether a movie was liked. The same three real events have mean 1/3 in either order.

The plain scalar recurrence is `h = tanh(0.8*x + u*h_previous)`, with initial state zero and no bias. Two padding positions, both with value zero, follow the real events. Masking (default) skips those updates. The trace reports each proposed `candidate`, but `state` remains the previous value for a skipped position. `real_final` is the state after the third real event; `final` includes the two padding positions according to the mask policy. These internal signed states are not probabilities.

The default real states are approximately `[0.664037, 0.811709, -0.374929]`; the reversed history ends at 0.769166. Without masking, the original history ends near -0.092385. No recurrence weights are trained, and no LSTM, GRU, bidirectional model, or transformer is implemented.

## 3. Freeze or adapt

`transfer --mode frozen|finetune` computes one genuine analytic SGD step. Both policies start from the same hand-set values in `data.json`. The mode name `finetune` illustrates the update policy; no source pretraining has happened, so this is not a real transfer-learning evaluation.

Two authored input features `(0.8, 0.2)` and a binary label 1 describe one toy movie example. The two-unit tanh backbone creates a representation. A sigmoid head predicts a probability. The parameter vector is:

`[w11, w12, b1, w21, w22, b2, v1, v2, head_bias]`.

The backbone has 6 parameters and the head has 3. Binary cross-entropy is evaluated stably from the logit. All derivatives are evaluated at the original parameters before the simultaneous update. The `gradient` field exposes all mathematical derivatives; the `trainable` mask determines which derivatives actually update parameters. In frozen mode only indices 6-8 change. Rate is 0.1, with no regularization or optimizer state.

Initial loss is 0.535086. The frozen step reaches 0.513414 and the full step 0.504296. Both improve this single example; neither establishes performance on unseen movies or viewers. The head update is identical in both modes because both start from identical features. It could differ after further steps as adapted features change.

## Read the code

Start with `convolve`, `sequence`, and `forward`, then inspect `transfer` to see the update mask. `test_explore.py` independently checks hand calculations, output sizes, pooling borders, order sensitivity, masking, finite-difference gradients, freezing, and malformed inputs. The website uses matching JavaScript arithmetic; tests allow small floating-point differences across runtimes.

The chapter's PyTorch snippet is a separate explanatory pattern. This workbook neither imports PyTorch nor downloads a model. To turn the ideas into a real application, define a target task and split, load a suitable backbone with its preprocessing, train a compatible head, and evaluate the chosen policy on separate data.
