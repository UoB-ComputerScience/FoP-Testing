package courseworks.fop2025;

import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
import org.junit.Assert;
import org.junit.Assume;
import org.junit.Test;

/**
 * Evidence from the preserved early methods in the original 2025 coursework.
 * These tests use controlled state and a null GUI; they do not exercise keyboard
 * input, startup, rendering or the complete game, and do not award marks.
 * The runner must execute each selected test method in a fresh bounded JVM.
 */
public class EarlyTasksTest {
    private static final String PACKAGE = "uk.ac.bradford.farmgame.";
    private static final int WIDTH = 36;
    private static final int HEIGHT = 20;

    /** Checks Task 1 assignment and bounds, without prescribing a spawn tile. */
    @Test
    public void task1PlayerCreated() throws Throwable {
        Object engine = freshEngine();
        installGrid(engine, true);
        writeField(engine, "player", studentClass("Player"), null);
        invokeRequired(engine, "createPlayer", new Class<?>[0]);
        Object player = readField(engine, "player", studentClass("Player"));
        Assert.assertNotNull("createPlayer() must assign the player field", player);
        int x = coordinate(player, "getX");
        int y = coordinate(player, "getY");
        Assert.assertTrue("Player X must be within 0..35; actual " + x, x >= 0 && x < WIDTH);
        Assert.assertTrue("Player Y must be within 0..19; actual " + y, y >= 0 && y < HEIGHT);
    }

    /** Checks only the original Task 2 up movement, from an interior tile. */
    @Test
    public void task2MoveUp() throws Throwable {
        assertMovement(1, 17, 8);
    }

    /** Checks only the original Task 2 right movement, from an interior tile. */
    @Test
    public void task2MoveRight() throws Throwable {
        assertMovement(2, 18, 9);
    }

    /** Checks only the original Task 2 down movement, from an interior tile. */
    @Test
    public void task2MoveDown() throws Throwable {
        assertMovement(3, 17, 10);
    }

    /** Checks only the original Task 2 left movement, from an interior tile. */
    @Test
    public void task2MoveLeft() throws Throwable {
        assertMovement(4, 16, 9);
    }

    /** Checks that the early movement method leaves turn advancement to input. */
    @Test
    public void task2DoesNotAdvanceTurn() throws Throwable {
        for (int direction = 1; direction <= 4; direction++) {
            Object engine = movementFixture(17, 9);
            int before = (Integer) readField(engine, "turnNumber", int.class);
            invokeRequired(engine, "movePlayer", new Class<?>[]{int.class}, direction);
            int after = (Integer) readField(engine, "turnNumber", int.class);
            Assert.assertEquals("movePlayer(" + direction + ") must not advance the turn", before, after);
        }
    }

    /** Checks Task 3 dimensions, population and tile types, not final-map layout. */
    @Test
    public void task3GridShape() throws Throwable {
        assertPopulatedGrid(generateEarlyFarm());
    }

    /** Checks the explicit Task 3 requirement for a new Tile in every cell. */
    @Test
    public void task3DistinctTiles() throws Throwable {
        Object grid = generateEarlyFarm();
        assertPopulatedGrid(grid);
        Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<Object, Boolean>());
        for (int x = 0; x < WIDTH; x++) {
            Object column = Array.get(grid, x);
            for (int y = 0; y < HEIGHT; y++) {
                Assert.assertTrue("Tile object reused at [" + x + "][" + y + "]",
                        seen.add(Array.get(column, y)));
            }
        }
    }

    /** Checks valid movement and outward rejection through the Task 4 method. */
    @Test
    public void task4Boundaries() throws Throwable {
        int[][] validMoves = {
            {17, 9, 1, 17, 8},
            {17, 9, 2, 18, 9},
            {17, 9, 3, 17, 10},
            {17, 9, 4, 16, 9},
            {17, 1, 1, 17, 0},
            {WIDTH - 2, 9, 2, WIDTH - 1, 9},
            {17, HEIGHT - 2, 3, 17, HEIGHT - 1},
            {1, 9, 4, 0, 9},
            {17, 0, 3, 17, 1},
            {WIDTH - 1, 9, 4, WIDTH - 2, 9},
            {17, HEIGHT - 1, 1, 17, HEIGHT - 2},
            {0, 9, 2, 1, 9}
        };
        for (int[] move : validMoves) {
            Object engine = movementFixture(move[0], move[1]);
            invokeRequired(engine, "betterMovePlayer", new Class<?>[]{int.class}, move[2]);
            assertPlayerPosition(engine, move[3], move[4],
                    "betterMovePlayer(" + move[2] + ") from (" + move[0] + "," + move[1] + ")");
        }
        for (int x = 0; x < WIDTH; x++) {
            assertBlockedMovement(x, 0, 1);
            assertBlockedMovement(x, HEIGHT - 1, 3);
        }
        for (int y = 0; y < HEIGHT; y++) {
            assertBlockedMovement(0, y, 4);
            assertBlockedMovement(WIDTH - 1, y, 2);
        }
    }

    private static void assertMovement(int direction, int expectedX, int expectedY) throws Throwable {
        Object engine = movementFixture(17, 9);
        invokeRequired(engine, "movePlayer", new Class<?>[]{int.class}, direction);
        assertPlayerPosition(engine, expectedX, expectedY, "movePlayer(" + direction + ")");
    }

    private static void assertBlockedMovement(int x, int y, int direction) throws Throwable {
        Object engine = movementFixture(x, y);
        invokeRequired(engine, "betterMovePlayer", new Class<?>[]{int.class}, direction);
        assertPlayerPosition(engine, x, y,
                "betterMovePlayer(" + direction + ") from (" + x + "," + y + ")");
    }

    private static void assertPlayerPosition(Object engine, int x, int y, String context) throws Throwable {
        Object player = readField(engine, "player", studentClass("Player"));
        Assert.assertNotNull(context + " must retain a player", player);
        Assert.assertEquals(context + " X", x, coordinate(player, "getX"));
        Assert.assertEquals(context + " Y", y, coordinate(player, "getY"));
    }

    private static Object movementFixture(int x, int y) throws Throwable {
        Object engine = freshEngine();
        installGrid(engine, false);
        Class<?> playerClass = studentClass("Player");
        Object player = construct(playerClass, new Class<?>[]{int.class, int.class}, x, y);
        writeField(engine, "player", playerClass, player);
        Object actualX = fixtureValue(player, "getX");
        Object actualY = fixtureValue(player, "getY");
        if (!Integer.valueOf(x).equals(actualX) || !Integer.valueOf(y).equals(actualY)) {
            throw adapterRequired("Player constructor/getters do not preserve the requested fixture position", null);
        }
        return engine;
    }

    private static Object freshEngine() {
        Class<?> engineClass = studentClass("GameEngine");
        Class<?> guiClass = studentClass("GameGUI");
        Object engine = construct(engineClass, new Class<?>[]{guiClass}, new Object[]{null});
        initializeOptionalDebris(engine);
        return engine;
    }

    private static void initializeOptionalDebris(Object engine) {
        Field debris;
        try {
            debris = engine.getClass().getDeclaredField("debris");
        } catch (NoSuchFieldException ex) {
            return;
        } catch (SecurityException ex) {
            throw adapterRequired("cannot inspect optional debris fixture field", ex);
        }
        if (!debris.getType().isArray()) {
            return;
        }
        try {
            debris.setAccessible(true);
            debris.set(engine, Array.newInstance(debris.getType().getComponentType(), 0));
        } catch (IllegalAccessException | RuntimeException ex) {
            throw adapterRequired("cannot initialize optional debris fixture field", ex);
        }
    }

    private static void installGrid(Object engine, boolean includeBed) {
        Class<?> tileClass = studentClass("Tile");
        Class<?> typeClass = studentClass("Tile$TileType");
        Object stone = enumValue(typeClass, "STONE_GROUND", true);
        Object bed = includeBed ? enumValue(typeClass, "BED", false) : null;
        Object grid = Array.newInstance(tileClass, WIDTH, HEIGHT);
        for (int x = 0; x < WIDTH; x++) {
            Object column = Array.get(grid, x);
            for (int y = 0; y < HEIGHT; y++) {
                Object type = bed != null && x == 17 && y == 9 ? bed : stone;
                Object tile = construct(tileClass, new Class<?>[]{typeClass}, type);
                if (fixtureValue(tile, "getType") != type) {
                    throw adapterRequired("Tile constructor/getType does not preserve the requested fixture type", null);
                }
                Array.set(column, y, tile);
            }
        }
        writeField(engine, "level", grid.getClass(), grid);
    }

    private static Object fixtureValue(Object target, String getter) {
        try {
            return invokeSupport(target, getter);
        } catch (Throwable ex) {
            throw adapterRequired("support getter failed during fixture setup: " + getter, ex);
        }
    }

    private static Object generateEarlyFarm() throws Throwable {
        Object engine = freshEngine();
        Class<?> gridClass = Array.newInstance(studentClass("Tile"), 0, 0).getClass();
        writeField(engine, "level", gridClass, null);
        invokeRequired(engine, "generateFarm", new Class<?>[0]);
        return readField(engine, "level", gridClass);
    }

    private static void assertPopulatedGrid(Object grid) throws Throwable {
        Assert.assertNotNull("generateFarm() must assign level", grid);
        Assert.assertEquals("level must have 36 X columns", WIDTH, Array.getLength(grid));
        Class<?> typeClass = studentClass("Tile$TileType");
        for (int x = 0; x < WIDTH; x++) {
            Object column = Array.get(grid, x);
            Assert.assertNotNull("Column " + x + " must exist", column);
            Assert.assertEquals("Column " + x + " must have 20 Y cells", HEIGHT, Array.getLength(column));
            for (int y = 0; y < HEIGHT; y++) {
                String cell = "Tile at [" + x + "][" + y + "]";
                Object tile = Array.get(column, y);
                Assert.assertNotNull(cell + " must exist", tile);
                Object type = invokeSupport(tile, "getType");
                Assert.assertNotNull(cell + " must have a type", type);
                Assert.assertTrue(cell + " must use TileType", typeClass.isInstance(type));
            }
        }
    }

    private static int coordinate(Object player, String getter) throws Throwable {
        Object value = invokeSupport(player, getter);
        if (!(value instanceof Integer)) {
            throw adapterRequired(getter + " no longer returns an int", null);
        }
        return (Integer) value;
    }

    private static Class<?> studentClass(String name) {
        try {
            return Class.forName(PACKAGE + name);
        } catch (ClassNotFoundException | LinkageError | SecurityException ex) {
            throw adapterRequired("cannot load " + PACKAGE + name, ex);
        }
    }

    private static Object construct(Class<?> type, Class<?>[] parameterTypes, Object... arguments) {
        try {
            Constructor<?> constructor = type.getDeclaredConstructor(parameterTypes);
            constructor.setAccessible(true);
            return constructor.newInstance(arguments);
        } catch (InvocationTargetException ex) {
            throw adapterRequired("constructor failed for " + type.getName(), ex.getCause());
        } catch (ReflectiveOperationException | RuntimeException | LinkageError ex) {
            throw adapterRequired("cannot construct " + type.getName(), ex);
        }
    }

    private static Object enumValue(Class<?> type, String name, boolean required) {
        Object[] values = type.getEnumConstants();
        if (values == null) {
            throw adapterRequired(type.getName() + " is no longer an enum", null);
        }
        for (Object value : values) {
            if (((Enum<?>) value).name().equals(name)) {
                return value;
            }
        }
        if (required) {
            throw adapterRequired("missing fixture tile type " + name, null);
        }
        return null;
    }

    private static Field field(Object engine, String name, Class<?> expectedType) {
        try {
            Field field = engine.getClass().getDeclaredField(name);
            if (field.getType() != expectedType) {
                throw adapterRequired("field " + name + " has changed type", null);
            }
            field.setAccessible(true);
            return field;
        } catch (ReflectiveOperationException | RuntimeException ex) {
            throw adapterRequired("cannot access field " + name, ex);
        }
    }

    private static Object readField(Object engine, String name, Class<?> type) {
        try {
            return field(engine, name, type).get(engine);
        } catch (IllegalAccessException | IllegalArgumentException ex) {
            throw adapterRequired("cannot read field " + name, ex);
        }
    }

    private static void writeField(Object engine, String name, Class<?> type, Object value) {
        try {
            field(engine, name, type).set(engine, value);
        } catch (IllegalAccessException | IllegalArgumentException ex) {
            throw adapterRequired("cannot set fixture field " + name, ex);
        }
    }

    private static Object invokeRequired(Object engine, String name, Class<?>[] types,
            Object... arguments) throws Throwable {
        Method method;
        try {
            method = engine.getClass().getDeclaredMethod(name, types);
        } catch (NoSuchMethodException ex) {
            throw new AssertionError("Required method missing: " + engine.getClass().getName()
                    + "." + name + (types.length == 0 ? "()" : "(int)"), ex);
        } catch (SecurityException ex) {
            throw adapterRequired("cannot inspect method " + name, ex);
        }
        return invoke(method, engine, arguments);
    }

    private static Object invokeSupport(Object target, String name) throws Throwable {
        Method method;
        try {
            method = target.getClass().getMethod(name);
        } catch (ReflectiveOperationException | SecurityException ex) {
            throw adapterRequired("cannot access support method " + name, ex);
        }
        return invoke(method, target);
    }

    private static Object invoke(Method method, Object target, Object... arguments) throws Throwable {
        try {
            method.setAccessible(true);
        } catch (RuntimeException ex) {
            throw adapterRequired("cannot access method " + method.getName(), ex);
        }
        try {
            return method.invoke(target, arguments);
        } catch (InvocationTargetException ex) {
            throw ex.getCause();
        } catch (IllegalAccessException | IllegalArgumentException ex) {
            throw adapterRequired("cannot invoke method " + method.getName(), ex);
        }
    }

    private static AssertionError adapterRequired(String detail, Throwable cause) {
        String suffix = cause == null ? "" : " (" + cause.getClass().getSimpleName() + ")";
        Assume.assumeTrue("Adapter required: " + detail + suffix, false);
        return new AssertionError("Unreachable after failed assumption");
    }
}
