"""Inspectable CNN, recurrence, and parameter-freezing arithmetic. Standard library only."""
import argparse
import json
import math
from pathlib import Path

DATA = json.loads(Path(__file__).with_name("data.json").read_text(encoding="utf-8"))


def matrix(m):
    if not isinstance(m, list) or not m or not isinstance(m[0], list) or not m[0] or not all(isinstance(row, list) and len(row) == len(m[0]) and all(type(v) in (int, float) and math.isfinite(v) for v in row) for row in m):
        raise ValueError("Expected a nonempty rectangular finite matrix.")


def convolve(image, kernel, stride=1, padding=0):
    matrix(image)
    matrix(kernel)
    if type(stride) is not int or stride < 1 or type(padding) is not int or padding < 0:
        raise ValueError("Invalid stride or padding.")
    height = (len(image) + 2 * padding - len(kernel)) // stride + 1
    width = (len(image[0]) + 2 * padding - len(kernel[0])) // stride + 1
    if height < 1 or width < 1:
        raise ValueError("Kernel does not fit.")
    def pixel(r, c):
        return image[r][c] if 0 <= r < len(image) and 0 <= c < len(image[0]) else 0
    return [[sum(k * pixel(i * stride + a - padding, j * stride + b - padding)
                 for a, row in enumerate(kernel) for b, k in enumerate(row))
             for j in range(width)] for i in range(height)]


def pool(image):
    matrix(image)
    height, width = len(image) // 2, len(image[0]) // 2
    if not height or not width:
        raise ValueError("A 2 by 2 window must fit.")
    return [[max(image[2*i+a][2*j+b] for a in range(2) for b in range(2))
             for j in range(width)] for i in range(height)]


def cnn(poster="edge", filter="vertical", stride=1, padding=0):
    if poster not in DATA["posters"] or filter not in DATA["kernels"] or type(stride) is not int or stride not in (1, 2) or type(padding) is not int or padding not in (0, 1):
        raise ValueError("Invalid CNN configuration.")
    image, kernel = DATA["posters"][poster], DATA["kernels"][filter]
    output = convolve(image, kernel, stride, padding)
    activation = [[max(0, x) for x in row] for row in output]
    flat = [v for row in activation for v in row]
    return dict(poster=poster, filter=filter, stride=stride, padding=padding,
                input=image, kernel=kernel, output=output, activation=activation,
                pooled=pool(activation), global_mean=sum(flat)/len(flat), parameters=10)


def sequence(history="original", recurrent=0.5, mask=True):
    if history not in DATA["histories"] or type(recurrent) not in (int, float) or recurrent not in (0, 0.5, 1) or type(mask) is not bool:
        raise ValueError("Invalid sequence configuration.")
    inputs = DATA["histories"][history]
    h, steps = 0, []
    for i, x in enumerate(inputs + [0, 0]):
        previous, padding = h, i >= len(inputs)
        candidate = math.tanh(0.8*x + recurrent*h)
        if not (padding and mask):
            h = candidate
        steps.append(dict(step=i+1, x=x, padding=padding, skipped=padding and mask,
                          previous=previous, candidate=candidate, state=h))
    return dict(history=history, recurrent=recurrent, mask=mask, inputs=inputs,
                mean=sum(inputs)/len(inputs), steps=steps,
                real_final=steps[len(inputs)-1]["state"], final=h)


def forward(theta, input=None, label=None):
    input = DATA["transfer"]["input"] if input is None else input
    label = DATA["transfer"]["label"] if label is None else label
    if len(theta) != 9 or not all(type(v) in (int, float) and math.isfinite(v) for v in theta) or len(input) != 2 or not all(type(v) in (int, float) and math.isfinite(v) for v in input) or type(label) is not int or label not in (0, 1):
        raise ValueError("Invalid network values.")
    features = [math.tanh(theta[3*i]*input[0] + theta[3*i+1]*input[1] + theta[3*i+2]) for i in range(2)]
    logit = theta[6]*features[0] + theta[7]*features[1] + theta[8]
    probability = 1 / (1 + math.exp(-logit)) if logit >= 0 else math.exp(logit) / (1 + math.exp(logit))
    loss = max(logit, 0) - label*logit + math.log1p(math.exp(-abs(logit)))
    d, gradient = probability - label, [0.0]*9
    for i in range(2):
        delta = d*theta[6+i]*(1-features[i]**2)
        gradient[3*i:3*i+3] = [delta*input[0], delta*input[1], delta]
        gradient[6+i] = d*features[i]
    gradient[8] = d
    return dict(features=features, logit=logit, probability=probability, loss=loss, gradient=gradient)


def transfer(mode="frozen"):
    if mode not in ("frozen", "finetune"):
        raise ValueError("Invalid transfer mode.")
    source = DATA["transfer"]
    theta, input, label, rate = source["theta"], source["input"], source["label"], source["rate"]
    before = forward(theta, input, label)
    trainable = [mode == "finetune" or i >= 6 for i in range(9)]
    after_theta = [p - (rate*before["gradient"][i] if trainable[i] else 0) for i, p in enumerate(theta)]
    after = forward(after_theta, input, label)
    return dict(mode=mode, input=input, label=label, rate=rate, before_theta=list(theta),
                after_theta=after_theta, trainable=trainable, trainable_count=sum(trainable),
                total_count=9, before=before, after=after,
                backbone_change=max(abs(after_theta[i]-theta[i]) for i in range(6)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    c = commands.add_parser("cnn")
    c.add_argument("--poster", choices=DATA["posters"], default="edge")
    c.add_argument("--filter", choices=DATA["kernels"], default="vertical")
    c.add_argument("--stride", type=int, choices=(1, 2), default=1)
    c.add_argument("--padding", type=int, choices=(0, 1), default=0)
    s = commands.add_parser("sequence")
    s.add_argument("--history", choices=DATA["histories"], default="original")
    s.add_argument("--recurrent", type=float, choices=(0, 0.5, 1), default=0.5)
    s.add_argument("--no-mask", action="store_true")
    t = commands.add_parser("transfer")
    t.add_argument("--mode", choices=("frozen", "finetune"), default="frozen")
    args = parser.parse_args()
    if args.command == "cnn":
        report = cnn(args.poster, args.filter, args.stride, args.padding)
    elif args.command == "sequence":
        report = sequence(args.history, args.recurrent, not args.no_mask)
    else:
        report = transfer(args.mode)
    print(json.dumps(report, allow_nan=False, indent=2))


if __name__ == "__main__":
    main()
