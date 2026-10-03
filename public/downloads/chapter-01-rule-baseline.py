"""Chapter 1: a deliberately limited phrase rule. Python 3; no dependencies."""


def should_flag(message):
    return "claim your prize" in message.lower()


examples = [
    ("CLAIM YOUR PRIZE now", True),
    ("A reward awaits; send your account details", True),
    ("Training: avoid messages saying 'claim your prize'", False),
    ("Tomorrow's project meeting agenda", False),
]

correct = 0
for message, expected in examples:
    predicted = should_flag(message)
    correct += int(predicted == expected)
    print(f"predicted={predicted}, expected={expected}")

print(f"Correct decisions: {correct}/{len(examples)}")
