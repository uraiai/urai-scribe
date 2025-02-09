local prompt = urai.prompts.get("improve_text")

local M = {}

M.execute = function(context)
	local llm = urai.llm.get("gpt-4o-mini")
	local resp = llm.chat({ system_prompt = prompt, variables = context.input })
	return resp.output.as_json()
end

return M
