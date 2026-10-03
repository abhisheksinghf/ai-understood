import math
import unittest
from language import DATA, tokenize, train_bpe, words, fit_bigram, distribution, decoding, generate, score, explore


class LanguageTests(unittest.TestCase):
    def test_bpe_merge_learning(self):
        m = train_bpe(16)
        self.assertEqual(m["merges"][0],dict(rank=1,left=115,right=32,id=256,count=10,piece="s␠"))
        self.assertEqual(len(m["vocabulary"]),272)
        self.assertEqual(tokenize()["ids"],[270,102,268,46])
        self.assertEqual(tokenize("zzzzzz")["merges"],m["merges"])

    def test_unicode_and_whitespace(self):
        for text in ["",*DATA["samples"],"\ufeffthis\nmovie\t","e\u0301","电影 🎬"]:
            for budget in (0,8,16,24):
                r = tokenize(text,budget)
                self.assertEqual(r["decoded"],text)
                self.assertEqual(r["byte_count"],len(text.encode("utf-8")))
                self.assertEqual([b for t in r["tokens"] for b in t["bytes"]],list(text.encode("utf-8")))
        r = tokenize("🎬",0)
        self.assertEqual((r["codepoints"],r["byte_count"],len(r["ids"])),(1,4,4))

    def test_merge_budget(self):
        for text in DATA["samples"]:
            counts = [len(tokenize(text,n)["ids"]) for n in range(25)]
            self.assertEqual(counts,sorted(counts,reverse=True))
        self.assertNotEqual(tokenize("movie")["ids"],tokenize(" movie")["ids"])

    def test_bigram_counts(self):
        self.assertEqual(words("Movie, FUN!"),["movie",",","fun","!"])
        m = fit_bigram()
        self.assertEqual(len(m["vocabulary"]),13)
        self.assertEqual(sum(m["counts"]["<bos>"]),6)
        self.assertEqual(sum(m["counts"]["<eos>"]),0)
        self.assertEqual(m["counts"]["."][0],6)

    def test_probability_formula(self):
        for alpha in (0,1):
            for context in ("<bos>","is","movie","unknown"):
                d = distribution(context,alpha)
                self.assertAlmostEqual(sum(r["probability"] for r in d["rows"]),1 if d["denominator"] else 0)
        d = distribution("is",1)
        self.assertEqual(d["denominator"],17)
        self.assertAlmostEqual(next(r["probability"] for r in d["rows"] if r["token"] == "fun"),3/17)
        self.assertEqual(generate("unknown",0)["stop"],"No observed continuation")

    def test_temperature_and_topk(self):
        rows = distribution("is",1)["rows"]
        probs = [next(r["sampling_probability"] for r in decoding(rows,t,0) if r["token"] == "fun") for t in (.5,1,2)]
        self.assertGreater(probs[0],probs[1])
        self.assertGreater(probs[1],probs[2])
        for t in (.5,1,2):
            for k in (0,3):
                d = decoding(rows,t,k)
                self.assertAlmostEqual(sum(r["sampling_probability"] for r in d),1)
                if k:
                    self.assertEqual(sum(r["sampling_probability"] > 0 for r in d),3)

    def test_greedy_and_context(self):
        for t in (.5,1,2):
            for k in (0,3):
                self.assertEqual(generate("this movie is",1,t,k,"greedy")["generated_tokens"],["fun",".","<eos>"])
        self.assertEqual(generate("this movie is")["steps"],generate("this film is")["steps"])

    def test_sampling_and_stopping(self):
        a = generate()
        self.assertEqual(a,generate())
        self.assertEqual(a["generated_tokens"],["feels","<unk>","is","a","film","<eos>"])
        self.assertAlmostEqual(a["steps"][0]["draw"],1083814273/4294967296)
        self.assertEqual(a["stop"],"End token")
        self.assertEqual(generate(method="greedy",limit=1)["stop"],"Token limit")

    def test_scoring(self):
        s = score(alpha=0)
        self.assertEqual(s["target_count"],6)
        self.assertAlmostEqual(s["mean_nll"],math.log(2)/2)
        self.assertAlmostEqual(s["perplexity"],math.sqrt(2))
        bad = score(DATA["scores"]["unknown"],0)
        self.assertIsNone(bad["perplexity"])
        self.assertEqual(bad["zero_probabilities"],2)
        self.assertEqual(bad["unknowns"],["dazzling"])
        self.assertEqual(explore(temperature=.5,topk=3,method="greedy")["scoring"],explore(temperature=2)["scoring"])

    def test_invalid_inputs(self):
        for text in ("x"*201,"\ud800",None):
            with self.assertRaises(ValueError): tokenize(text)
        for call in (lambda:train_bpe(25),lambda:train_bpe(True),lambda:distribution("is",-1),lambda:decoding([],0),lambda:generate(method="bad"),lambda:generate(seed=-1),lambda:explore(score_case="bad")):
            with self.assertRaises(ValueError): call()


if __name__ == "__main__":
    unittest.main()
