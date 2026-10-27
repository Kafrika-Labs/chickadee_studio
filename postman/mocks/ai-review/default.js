// Wire fixtures based on the providers' documented tool-call contracts.
const http = require('node:http');
http.createServer((req, res) => {
  const reply = (status, body) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); };
  try {
    const body = req.body;
    const claude = req.url === '/v1/messages';
    if (req.method !== 'POST' || !['/v1/messages','/v1/chat/completions','/openai/v1/chat/completions'].includes(req.url)) return reply(501, {});
    if (!body || !body.model || !Array.isArray(body.messages)) return reply(400, {error:{type:'invalid_request_error'}});
    if (claude ? (!req.headers['x-api-key'] || req.headers.authorization || req.headers['anthropic-version'] !== '2023-06-01') : (!req.headers.authorization || req.headers['x-api-key'])) return reply(401, {error:{type:'authentication_error'}});
    if (body.model === 'fixture-error') return reply(429, {error:{type:'rate_limit_error',message:'DO_NOT_ECHO_PROVIDER_BODY'}});
    const toolPhase = claude ? body.tool_choice?.type === 'any' : body.tool_choice === 'required';
    let id;
    if (toolPhase) {
      const schema = claude ? body.tools[0].input_schema : body.tools[0].function.parameters;
      id = schema.properties.evidence_id.enum[0];
      if (claude) return reply(200, {type:'message',role:'assistant',content:[{type:'tool_use',id:'tool_read',name:'evidence_read',input:{evidence_id:id}}],stop_reason:'tool_use',usage:{input_tokens:120,output_tokens:30}});
      return reply(200, {choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'tool_read',type:'function',function:{name:'evidence_read',arguments:JSON.stringify({evidence_id:id})}}]}}],usage:{total_tokens:150}});
    }
    if (claude) {
      if (body.max_completion_tokens || body.response_format || !body.max_tokens || !body.tools?.length || body.tool_choice.type !== 'none') return reply(400,{error:{type:'invalid_request_error'}});
      const index = body.messages.findIndex(m => m.role === 'assistant' && m.content.some(c => c.type === 'tool_use'));
      const next = body.messages[index+1];
      if (next?.role !== 'user' || next.content[0]?.type !== 'tool_result' || next.content[0].tool_use_id !== 'tool_read') return reply(400,{error:{type:'invalid_request_error'}});
      id = JSON.parse(next.content[0].content).evidence_id;
    } else {
      id = JSON.parse(body.messages.find(m=>m.role==='tool').content).evidence_id;
    }
    const content = JSON.stringify({assessment:'ad_suspected',evidence_ids:[id],summary:'가입을 유도하는 문구가 관찰되었습니다.',missing_evidence:[],recommended_next_action:'human_review'});
    if (claude) return reply(200,{type:'message',role:'assistant',content:[{type:'text',text:content}],stop_reason:'end_turn',usage:{input_tokens:200,output_tokens:50}});
    reply(200,{choices:[{finish_reason:'stop',message:{role:'assistant',content}}],usage:{total_tokens:250}});
  } catch (_) { reply(400,{error:{type:'invalid_request_error'}}); }
}).listen(process.env.PORT || 4500);
