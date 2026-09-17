import os
import tempfile
import unittest

from categorizer import add_user_pattern, categorize, load_user_patterns


class CategorizeTests(unittest.TestCase):
    def test_video_domain(self):
        self.assertEqual(categorize("https://www.youtube.com/watch?v=abc"), "video")

    def test_code_domain(self):
        self.assertEqual(categorize("https://github.com/ekansh-exe/nibame"), "code")

    def test_social_domain(self):
        self.assertEqual(categorize("https://instagram.com/some_post"), "social")

    def test_music_domain(self):
        self.assertEqual(categorize("https://open.spotify.com/track/123"), "music")

    def test_case_insensitive_domain(self):
        self.assertEqual(categorize("https://YouTube.com/watch?v=abc"), "video")

    def test_strips_www_prefix(self):
        self.assertEqual(categorize("https://www.github.com/foo/bar"), "code")

    def test_pdf_path_fallback(self):
        self.assertEqual(categorize("https://example.com/files/report.pdf"), "document")

    def test_reel_path_fallback(self):
        self.assertEqual(categorize("https://unknownsite.com/reel/123"), "video")

    def test_unknown_fallback(self):
        self.assertEqual(categorize("https://example.com/whatever"), "unknown")

    def test_unrecognized_shortener_is_unknown(self):
        # No network calls are made, so a shortener can't be expanded -
        # it just falls through to unknown like any other unseen domain.
        self.assertEqual(categorize("https://bit.ly/3xample"), "unknown")
        self.assertEqual(categorize("https://t.co/abc123"), "unknown")

    def test_empty_url_is_unknown(self):
        self.assertEqual(categorize(""), "unknown")

    def test_url_without_scheme_is_unknown(self):
        # urlsplit treats this as a path, not a netloc, so it can't match
        # a domain rule - this is a known limitation of URL-only rules.
        self.assertEqual(categorize("youtube.com/watch?v=abc"), "unknown")

    def test_subdomain_not_confused_with_known_domain(self):
        # "youtube.com.evil.com" must not match on "youtube.com" as a substring.
        self.assertEqual(categorize("https://youtube.com.evil.com/x"), "unknown")


class UserPatternTests(unittest.TestCase):
    def setUp(self):
        fd, self.config_path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        os.remove(self.config_path)  # start from "file doesn't exist yet"

    def tearDown(self):
        if os.path.exists(self.config_path):
            os.remove(self.config_path)

    def test_missing_config_loads_empty(self):
        self.assertEqual(load_user_patterns(self.config_path), {})

    def test_add_pattern_is_saved_and_used(self):
        add_user_pattern("news.ycombinator.com", "news", path=self.config_path)
        patterns = load_user_patterns(self.config_path)
        self.assertEqual(patterns["news.ycombinator.com"], "news")

        result = categorize("https://news.ycombinator.com/item?id=1", user_patterns=patterns)
        self.assertEqual(result, "news")

    def test_user_pattern_overrides_builtin_rule(self):
        # user explicitly recategorized a domain that already had a built-in rule
        add_user_pattern("github.com", "article", path=self.config_path)
        patterns = load_user_patterns(self.config_path)
        result = categorize("https://github.com/some/repo", user_patterns=patterns)
        self.assertEqual(result, "article")

    def test_add_pattern_normalizes_domain(self):
        add_user_pattern("WWW.News.Example.com", "news", path=self.config_path)
        patterns = load_user_patterns(self.config_path)
        self.assertIn("news.example.com", patterns)

    def test_add_pattern_requires_domain_and_category(self):
        with self.assertRaises(ValueError):
            add_user_pattern("", "news", path=self.config_path)
        with self.assertRaises(ValueError):
            add_user_pattern("example.com", "", path=self.config_path)


if __name__ == "__main__":
    unittest.main()
