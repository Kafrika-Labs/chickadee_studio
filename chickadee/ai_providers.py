"""Provider-specific wire formats for the bounded evidence-review agent."""
import json

PROVIDERS = {
    'groq': {'name': 'Groq', 'model': 'openai/gpt-oss-20b',
             'endpoint': 'https://api.groq.com/openai/v1/chat/completions'},
    'openai': {'name': 'OpenAI', 'model': 'gpt-4.1-mini',
               'endpoint': 'https://api.openai.com/v1/chat/completions'},
    'anthropic': {'name': 'Claude', 'model': 'claude-haiku-4-5-20251001',
                  'endpoint': 'https://api.anthropic.com/v1/messages'},
}


def encode_request(provider, payload, key):
    if provider != 'anthropic':
        body = dict(payload)
        if provider == 'openai':
            body['store'] = False
            if body['model'].startswith(('gpt-5', 'gpt-6', 'o1', 'o3', 'o4')):
                body.pop('temperature', None)
        return body, {'Authorization': 'Bearer ' + key}
    body = {'model': payload['model'], 'max_tokens': payload['max_completion_tokens'],
            'stream': False, 'messages': []}
    systems = []
    for message in payload['messages']:
        role = message['role']
        if role == 'system':
            systems.append(message['content'])
            continue
        blocks = []
        if role == 'tool':
            role = 'user'
            blocks.append({'type': 'tool_result', 'tool_use_id': message['tool_call_id'],
                           'content': message['content']})
        else:
            if message.get('content'):
                blocks.append({'type': 'text', 'text': message['content']})
            for call in message.get('tool_calls', []):
                blocks.append({'type': 'tool_use', 'id': call['id'],
                               'name': call['function']['name'],
                               'input': json.loads(call['function']['arguments'])})
        if body['messages'] and body['messages'][-1]['role'] == role:
            body['messages'][-1]['content'].extend(blocks)
        else:
            body['messages'].append({'role': role, 'content': blocks})
    body['system'] = '\n'.join(systems)
    # Claude requires tool definitions when prior assistant turns contain tool_use.
    tools = payload.get('tools') or payload.get('_tool_definitions', [])
    if tools:
        body['tools'] = [{'name': item['function']['name'],
                          'description': item['function'].get('description', ''),
                          'input_schema': item['function']['parameters']} for item in tools]
        body['tool_choice'] = {'type': 'any' if payload.get('tools') else 'none'}
    return body, {'x-api-key': key, 'anthropic-version': '2023-06-01'}


def decode_response(provider, response):
    if provider != 'anthropic':
        return response
    blocks = response.get('content', [])
    message = {'role': 'assistant', 'content': ''.join(
        block['text'] for block in blocks if block.get('type') == 'text')}
    calls = [{'id': block['id'], 'type': 'function', 'function': {
        'name': block['name'], 'arguments': json.dumps(block['input'])}}
        for block in blocks if block.get('type') == 'tool_use']
    if calls:
        message['tool_calls'] = calls
    usage = response.get('usage', {})
    counts = [usage.get('input_tokens'), usage.get('output_tokens')]
    normalized_usage = {}
    if all(type(value) is int and value >= 0 for value in counts):
        normalized_usage['total_tokens'] = sum(counts) + sum(
            value for name in ('cache_creation_input_tokens', 'cache_read_input_tokens')
            if type(value := usage.get(name, 0)) is int and value >= 0)
    finish = {'end_turn': 'stop', 'tool_use': 'tool_calls'}.get(response.get('stop_reason'), 'incomplete')
    return {'choices': [{'message': message, 'finish_reason': finish}], 'usage': normalized_usage}
