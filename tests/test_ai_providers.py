import tempfile
import unittest
from chickadee.agent import settings
from chickadee.ai_providers import decode_response
from chickadee.bridge import DesktopBridge


class ProviderTests(unittest.TestCase):
    def test_switch_requires_new_key_and_never_exposes_key(self):
        with tempfile.TemporaryDirectory() as folder:
            bridge = DesktopBridge(folder, lambda _: None)
            key = 'gsk_private_fixture_key'
            first = bridge._inspection_command('agent-configure', {'provider':'groq','api_key':key})
            self.assertNotIn(key, str(first))
            with self.assertRaises(ValueError):
                bridge._inspection_command('agent-configure', {'provider':'openai','api_key':''})
            self.assertEqual(bridge.agent_config['provider'], 'groq')
            configured = bridge._inspection_command('agent-configure', {'provider':'openai','api_key':'sk_openai_fixture_key'})
            self.assertEqual(configured['provider'], 'openai')
            self.assertEqual(configured['model'], 'gpt-4.1-mini')
            self.assertNotIn('api_key', configured)
            updated = bridge._inspection_command('agent-configure', {'provider':'openai','api_key':'','model':'gpt-4.1'})
            self.assertEqual(updated['model'], 'gpt-4.1')
            status = bridge._inspection_command('agent-status', {})
            self.assertEqual(status['provider'], 'openai')
            self.assertNotIn('sk_openai_fixture_key', str(status))
            self.assertIsNone(DesktopBridge(folder, lambda _: None).agent_config)

    def test_invalid_provider_and_truncated_claude_response(self):
        for provider in ('unknown', [], None):
            with self.assertRaises(ValueError):
                settings({'provider':provider,'api_key':'test_fixture_key'})
        response = decode_response('anthropic', {'content':[{'type':'text','text':'partial'}], 'stop_reason':'max_tokens','usage':{}})
        self.assertEqual(response['choices'][0]['finish_reason'], 'incomplete')
        self.assertNotIn('total_tokens', response['usage'])
