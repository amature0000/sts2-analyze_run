using Godot;
using HarmonyLib;
using MegaCrit.Sts2.Core.Modding;
using MegaCrit.Sts2.Core.Nodes.Screens.RunHistoryScreen;
using MegaCrit.Sts2.Core.Runs;
using System;
using System.Text.Json;

[ModInitializer("ModInit")]
public static class ModStart
{
    public static void ModInit()
    {
		Harmony harmony = new Harmony("sharerun");
        harmony.PatchAll();
        GD.Print("[sharerun]Mod Initialized");
    }
}

[HarmonyPatch(typeof(NRunHistory), "DisplayRun")]
public static class RunHistoryPostfix
{
    public static void Postfix(object __instance, RunHistory history)
    {
        GD.Print("[sharerun]run history displayed");
        if (history.MapPointHistory == null) return;

        var options = new JsonSerializerOptions{WriteIndented = true};
        GD.Print("[sharerun] starting process");
        try
        {
            string jsonString = JsonSerializer.Serialize(history, options);
            string jsString = $"window.runData = {jsonString};";
            System.IO.File.WriteAllText("sharerun_history.js", jsonString);
            GD.Print("[sharerun] dumped run history");
        }
        catch (Exception e)
        {
            GD.PrintErr($"[sharerun] failed to dump: {e.Message}");
        }
        GD.Print("[sharerun] ended process");
    }
}