package courseworks.fop2025;

import java.util.List;
import runner.Coursework;
import runner.Coursework.Check;

/** Contract from the supplied 2025-26 specification and FoPCW2025 starter, not the unverified 2026 handoff. */
public final class Profile {
    private static Check check(String id, String group, String method, String description) {
        return new Check(id, group, "courseworks.fop2025.EarlyTasksTest", method, description);
    }

    public static Coursework coursework() {
        return new Coursework("fop-2025-26", "2", 24, "src",
                "src/uk/ac/bradford/farmgame/GameEngine.java",
                "Isolated early methods from Tasks 1-4. These results do not establish final keyboard movement, GUI behaviour, report quality or marks.",
                List.of(
                    check("task1.player", "task1", "task1PlayerCreated", "createPlayer assigns an in-bounds player"),
                    check("task2.up", "task2", "task2MoveUp", "movePlayer(1) moves one tile up"),
                    check("task2.right", "task2", "task2MoveRight", "movePlayer(2) moves one tile right"),
                    check("task2.down", "task2", "task2MoveDown", "movePlayer(3) moves one tile down"),
                    check("task2.left", "task2", "task2MoveLeft", "movePlayer(4) moves one tile left"),
                    check("task2.turn", "task2", "task2DoesNotAdvanceTurn", "movePlayer leaves turn advancement to the input handler"),
                    check("task3.grid", "task3", "task3GridShape", "generateFarm creates a populated 36 by 20 grid"),
                    check("task3.identity", "task3", "task3DistinctTiles", "generateFarm uses a distinct Tile per cell"),
                    check("task4.boundaries", "task4", "task4Boundaries", "betterMovePlayer rejects outward movement and permits valid movement")
                ));
    }
}
