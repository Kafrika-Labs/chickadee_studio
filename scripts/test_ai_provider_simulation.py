"""Run the real agent/HTTP transport against the local Postman simulation."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from copy import deepcopy
from unittest.mock import patch
from chickadee.agent import EvidenceAgent
from chickadee.ai_providers import PROVIDERS
from tests.test_inspection_agent import packet

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4901'
fixtures = deepcopy(PROVIDERS)
for provider, config in fixtures.items():
    config['endpoint'] = base + '/' + provider + ('/v1/messages' if provider == 'anthropic' else '/openai/v1/chat/completions' if provider == 'groq' else '/v1/chat/completions')
with patch.dict(PROVIDERS, fixtures), patch('chickadee.agent.ENDPOINT', fixtures['groq']['endpoint']):
    for provider in fixtures:
        agent = EvidenceAgent({'provider':provider,'api_key':'fixture-test-key','token_limit':60000})
        result = agent.investigate(packet())
        assert result['provider'] == provider
        assert result['status'] == 'completed' and result['ledger']['calls'] == 2
        assert result['ledger']['usage_tokens'] == 400
        assert result['reads'][0]['tool'] == 'evidence_read'
        failed = EvidenceAgent({'provider':provider,'api_key':'fixture-test-key','model':'fixture-error','token_limit':60000})
        try:
            failed.investigate(packet())
            raise AssertionError('Expected HTTP error')
        except ValueError as error:
            assert '429' in str(error) and 'DO_NOT_ECHO' not in str(error)
        assert failed.ledger['calls'] == 1 and failed.ledger['charged_tokens'] > 0
        print(f'PASS {provider}: tool calls, final JSON, usage and bounded HTTP 429 handling')
