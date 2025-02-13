local prompt = urai.prompts.get("improve_text")

local M = {}

M.execute = function(context)
	resp = urai.llm:chat({model="gpt-4o-mini", system_prompt = prompt, variables = context.input })
	return resp.output:as_json()
end

return M
