-- Lightweight Lua hook point for menu mods.
local menu_mod = {}

function menu_mod.on_main_menu_open(context)
  if context and context.logger then
    context.logger("HexaMine menu mod loaded")
  end
end

return menu_mod
