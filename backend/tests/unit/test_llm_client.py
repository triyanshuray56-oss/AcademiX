import unittest
from unittest.mock import MagicMock, patch

from backend.app.ai.llm_client import (
    _client_for,
    create_chat_completion,
    generate_json_object,
    get_ai_client,
    parse_json_response,
)


class LLMClientTests(unittest.TestCase):
    def tearDown(self) -> None:
        _client_for.cache_clear()

    @patch("backend.app.ai.llm_client.OpenAI")
    def test_client_uses_groq_base_and_key_precedence(self, openai_client: MagicMock) -> None:
        with patch.dict(
            "os.environ",
            {
                "GROQ_API_KEY": "groq-test-key",
                "CAMPUSLINK_AI_API_KEY": "legacy-test-key",
                "CAMPUSLINK_AI_API_BASE": "https://api.groq.com/openai/v1",
            },
        ):
            get_ai_client()

        openai_client.assert_called_once_with(
            base_url="https://api.groq.com/openai/v1",
            api_key="groq-test-key",
        )

    def test_json_completion_requests_json_object_and_uses_configured_model(self) -> None:
        client = MagicMock()
        client.chat.completions.create.return_value.choices[0].message.content = '{"score": 92}'
        with (
            patch("backend.app.ai.llm_client.get_ai_client", return_value=client),
            patch.dict(
                "os.environ",
                {
                    "CAMPUSLINK_AI_MODEL": "openai/gpt-oss-120b",
                },
            ),
        ):
            result = generate_json_object("system", "user")

        self.assertEqual(result, {"score": 92})
        call = client.chat.completions.create.call_args.kwargs
        self.assertEqual(call["model"], "openai/gpt-oss-120b")
        self.assertEqual(call["response_format"], {"type": "json_object"})
        self.assertEqual(call["messages"], [
            {"role": "system", "content": "system"},
            {"role": "user", "content": "user"},
        ])

    def test_json_parser_accepts_fenced_json_and_rejects_invalid_json(self) -> None:
        self.assertEqual(parse_json_response('```json\n{"ok": true}\n```'), {"ok": True})
        with self.assertRaises(ValueError):
            parse_json_response("{not-json}")

    def test_chat_completion_rejects_empty_provider_response(self) -> None:
        client = MagicMock()
        client.chat.completions.create.return_value.choices[0].message.content = None
        with patch("backend.app.ai.llm_client.get_ai_client", return_value=client):
            with self.assertRaisesRegex(ValueError, "empty response"):
                create_chat_completion([{"role": "user", "content": "hello"}])


if __name__ == "__main__":
    unittest.main()
