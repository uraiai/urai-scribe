local prompt = urai.prompts.get("improve_text")

local M = {}

M.execute = function(context)
	resp = urai.llm:chat({model="gemini-2.0-flash", system_prompt = prompt, variables = context.input })
	return resp.output:as_json()
end

return M
