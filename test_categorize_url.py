import unittest

from categorize_url import categorize


class CategorizeUrlTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
