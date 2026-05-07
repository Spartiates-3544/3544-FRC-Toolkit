package frc.robot.commands;

import edu.wpi.first.networktables.*;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.RobotBase;
import edu.wpi.first.wpilibj.RobotController;
import edu.wpi.first.wpilibj.Timer;
import edu.wpi.first.wpilibj2.command.Command;
import frc.robot.Constants;
import frc.lib.monitors.RobotHealthMonitor;
import frc.robot.subsystems.IntakeSubsystem;
import frc.robot.subsystems.SpindexerFeedSubsystem;
import frc.robot.subsystems.SpindexerHookSubsystem;
import frc.robot.subsystems.defaultSubsystems.CommandSwerveDrivetrain;

import java.util.ArrayList;
import java.util.List;
import frc.robot.subsystems.ElevatorSubsystem;

/**
 * SelfTestCommand — full interactive hardware self-test.
 *
 * MUST be scheduled while the robot is ENABLED (teleop or test mode).
 * Requires the drivetrain subsystem to prevent driving during the test.
 *
 * Test sequence:
 * 1. Initial battery / CAN / fault check
 * 2. Intake: forward run → pause → reverse run → coast-down
 * 3. SpindexerHook: spin up → coast-down
 * 4. SpindexerFeed: forward run → pause → reverse run → coast-down
 * 5. Post-motor temperature snapshot
 * 6. Gyro check — user physically rotates robot, confirms
 * 7. Vision check — user presents AprilTag to cameras, confirms
 *
 * NT namespace: /3544/SelfTest/
 * Robot publishes: State, StepIndex, StepCount, StepName, StepType,
 * StepStatus, StepDetail, StepTimeRemainSec,
 * LiveCurrentA, LiveTempC, LiveBatteryV,
 * PromptText, Results, IsSimulation
 * Dashboard publishes: RunRequest, AbortRequest,
 * UserConfirm, UserSkip, UserFail
 */
public class SelfTestCommand extends Command {

    // ── Step model ────────────────────────────────────────────────────────────

    public enum StepType {
        HEALTH_CHECK, MOTOR_RUN, WAIT, GYRO_CHECK, VISION_CHECK
    }

    public enum StepStatus {
        PENDING, RUNNING, PASS, WARNING, FAIL, SKIPPED
    }

    /** Immutable step definition built from Constants. */
    private static class StepDef {
        final String id;
        final String label;
        final String description;
        final StepType type;
        /**
         * Subsystem name for MOTOR_RUN / WAIT steps ("Intake", "SpindexerHook",
         * "SpindexerFeed").
         */
        final String subsystem;
        /** Duty-cycle (-1..1) for open-loop, or target RPM for velocity steps. */
        final double testOutput;
        /**
         * Duration in seconds for MOTOR_RUN, WAIT, GYRO_CHECK, VISION_CHECK; 0 for
         * HEALTH_CHECK.
         */
        final double durationSec;
        /** Prompt shown to the operator for interactive steps. */
        final String prompt;

        StepDef(String id, String label, String description, StepType type,
                String subsystem, double testOutput, double durationSec, String prompt) {
            this.id = id;
            this.label = label;
            this.description = description;
            this.type = type;
            this.subsystem = subsystem;
            this.testOutput = testOutput;
            this.durationSec = durationSec;
            this.prompt = prompt;
        }
    }

    /** Mutable result that accumulates measurements during execution. */
    private static class StepResult {
        final String id;
        final String label;
        final String description;
        StepStatus status = StepStatus.PENDING;
        String detail = "";
        double peakCurrentA = 0;
        double peakTempC = 0;

        StepResult(StepDef def) {
            this.id = def.id;
            this.label = def.label;
            this.description = def.description;
        }

        String toJson() {
            return "{\"id\":\"" + id + "\","
                    + "\"label\":\"" + esc(label) + "\","
                    + "\"description\":\"" + esc(description) + "\","
                    + "\"status\":\"" + status.name().toLowerCase() + "\","
                    + "\"detail\":\"" + esc(detail) + "\","
                    + "\"peakCurrentA\":" + String.format("%.1f", peakCurrentA) + ","
                    + "\"peakTempC\":" + String.format("%.0f", peakTempC) + "}";
        }

        private static String esc(String s) {
            if (s == null)
                return "";
            return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
        }
    }

    // ── Subsystems & services ─────────────────────────────────────────────────

    private final IntakeSubsystem intake;
    private final SpindexerHookSubsystem spindexerHook;
    private final SpindexerFeedSubsystem spindexerFeed;
    private final ElevatorSubsystem elevator;
    private final CommandSwerveDrivetrain drivetrain;
    private final RobotHealthMonitor healthMonitor;

    // ── NT publishers ─────────────────────────────────────────────────────────

    private final StringPublisher statePublisher;
    private final DoublePublisher stepIndexPublisher;
    private final DoublePublisher stepCountPublisher;
    private final StringPublisher stepNamePublisher;
    private final StringPublisher stepTypePublisher;
    private final StringPublisher stepStatusPublisher;
    private final StringPublisher stepDetailPublisher;
    private final DoublePublisher stepTimeRemainPublisher;
    private final DoublePublisher liveCurrentPublisher;
    private final DoublePublisher liveTempPublisher;
    private final DoublePublisher liveBatteryPublisher;
    private final StringPublisher promptPublisher;
    private final StringPublisher resultsPublisher;
    private final BooleanPublisher isSimPublisher;

    // ── NT subscribers (dashboard → robot) ───────────────────────────────────

    private final DoubleSubscriber abortRequestSub;
    private final DoubleSubscriber userConfirmSub;
    private final DoubleSubscriber userSkipSub;
    private final DoubleSubscriber userFailSub;

    // ── Static step definitions (built once per instance) ─────────────────────

    private final List<StepDef> stepDefs = new ArrayList<>();

    // ── Per-run state (reset in initialize()) ─────────────────────────────────

    private List<StepResult> stepResults;
    private int stepIndex = -1;
    private boolean aborted = false;
    private boolean firstEntry = true; // true on the first execute() call for current step

    private final Timer stepTimer = new Timer();

    /** Gyro heading recorded at the start of GYRO_CHECK. */
    private double gyroInitialDeg = 0;

    // Rising-edge sentinels — compared against subscriber values
    private double lastAbortRequest = -1;
    private double lastUserConfirm = -1;
    private double lastUserSkip = -1;
    private double lastUserFail = -1;

    // ── Constructor ───────────────────────────────────────────────────────────

    public SelfTestCommand(IntakeSubsystem intake,
            SpindexerHookSubsystem spindexerHook,
            SpindexerFeedSubsystem spindexerFeed,
            CommandSwerveDrivetrain drivetrain,
            RobotHealthMonitor healthMonitor,
            ElevatorSubsystem elevator) {
        this.intake = intake;
        this.spindexerHook = spindexerHook;
        this.spindexerFeed = spindexerFeed;
        this.drivetrain = drivetrain;
        this.healthMonitor = healthMonitor;
        this.elevator = elevator;

        addRequirements(drivetrain);

        var table = NetworkTableInstance.getDefault().getTable("3544").getSubTable("SelfTest");
        statePublisher = table.getStringTopic("State").publish();
        stepIndexPublisher = table.getDoubleTopic("StepIndex").publish();
        stepCountPublisher = table.getDoubleTopic("StepCount").publish();
        stepNamePublisher = table.getStringTopic("StepName").publish();
        stepTypePublisher = table.getStringTopic("StepType").publish();
        stepStatusPublisher = table.getStringTopic("StepStatus").publish();
        stepDetailPublisher = table.getStringTopic("StepDetail").publish();
        stepTimeRemainPublisher = table.getDoubleTopic("StepTimeRemainSec").publish();
        liveCurrentPublisher = table.getDoubleTopic("LiveCurrentA").publish();
        liveTempPublisher = table.getDoubleTopic("LiveTempC").publish();
        liveBatteryPublisher = table.getDoubleTopic("LiveBatteryV").publish();
        promptPublisher = table.getStringTopic("PromptText").publish();
        resultsPublisher = table.getStringTopic("Results").publish();
        isSimPublisher = table.getBooleanTopic("IsSimulation").publish();

        abortRequestSub = table.getDoubleTopic("AbortRequest").subscribe(-1.0);
        userConfirmSub = table.getDoubleTopic("UserConfirm").subscribe(-1.0);
        userSkipSub = table.getDoubleTopic("UserSkip").subscribe(-1.0);
        userFailSub = table.getDoubleTopic("UserFail").subscribe(-1.0);

        buildStepDefs();

        // Publish static fields once
        isSimPublisher.set(RobotBase.isSimulation());
        stepCountPublisher.set(stepDefs.size());
        statePublisher.set("idle");
        promptPublisher.set("");
        resultsPublisher.set("[]");
        stepIndexPublisher.set(-1);
    }

    // ── Step definition builder ───────────────────────────────────────────────

    private void buildStepDefs() {
        stepDefs.clear();

        // 1. Initial health checks (instant)
        stepDefs.add(new StepDef("health_battery", "Battery Voltage",
                "Validates voltage is within safe operating range",
                StepType.HEALTH_CHECK, "", 0, 0, ""));

        stepDefs.add(new StepDef("health_can", "CAN Devices",
                "Confirms all expected CAN devices are online",
                StepType.HEALTH_CHECK, "", 0, 0, ""));

        stepDefs.add(new StepDef("health_faults", "Motor Faults",
                "Reads and reports any active or sticky motor faults",
                StepType.HEALTH_CHECK, "", 0, 0, ""));

        // 2. Intake sequence
        stepDefs.add(new StepDef("intake_fwd", "Intake: Forward",
                String.format("Run at %.0f%% duty cycle for %.1f s — monitor current & temperature",
                        Constants.SelfTest.INTAKE_FWD_OUTPUT * 100, Constants.SelfTest.INTAKE_RUN_SEC),
                StepType.MOTOR_RUN, "Intake",
                Constants.SelfTest.INTAKE_FWD_OUTPUT, Constants.SelfTest.INTAKE_RUN_SEC, ""));

        stepDefs.add(new StepDef("intake_pause", "Intake: Pause",
                "Coast-down pause between directions",
                StepType.WAIT, "Intake", 0, Constants.SelfTest.INTAKE_PAUSE_SEC, ""));

        stepDefs.add(new StepDef("intake_rev", "Intake: Reverse",
                String.format("Run at %.0f%% reverse for %.1f s",
                        Constants.SelfTest.INTAKE_REV_OUTPUT * 100, Constants.SelfTest.INTAKE_RUN_SEC),
                StepType.MOTOR_RUN, "Intake",
                -Constants.SelfTest.INTAKE_REV_OUTPUT, Constants.SelfTest.INTAKE_RUN_SEC, ""));

        stepDefs.add(new StepDef("intake_stop", "Intake: Coast-down",
                "Motor stop and settle",
                StepType.WAIT, "Intake", 0, Constants.SelfTest.COAST_DOWN_SEC, ""));

        // 3. SpindexerHook sequence
        stepDefs.add(new StepDef("hook_spin", "SpindexerHook: Spin",
                String.format("Spin up to %.0f RPM for %.1f s — verify velocity control and current",
                        Constants.SelfTest.HOOK_TEST_RPM, Constants.SelfTest.HOOK_RUN_SEC),
                StepType.MOTOR_RUN, "SpindexerHook",
                Constants.SelfTest.HOOK_TEST_RPM, Constants.SelfTest.HOOK_RUN_SEC, ""));

        stepDefs.add(new StepDef("hook_stop", "SpindexerHook: Coast-down",
                "Motor stop and settle",
                StepType.WAIT, "SpindexerHook", 0, Constants.SelfTest.COAST_DOWN_SEC, ""));

        // 4. SpindexerFeed sequence
        stepDefs.add(new StepDef("feed_fwd", "SpindexerFeed: Forward",
                String.format("Run at %.0f%% duty cycle for %.1f s",
                        Constants.SelfTest.FEED_FWD_OUTPUT * 100, Constants.SelfTest.FEED_RUN_SEC),
                StepType.MOTOR_RUN, "SpindexerFeed",
                Constants.SelfTest.FEED_FWD_OUTPUT, Constants.SelfTest.FEED_RUN_SEC, ""));

        stepDefs.add(new StepDef("feed_pause", "SpindexerFeed: Pause",
                "Coast-down pause between directions",
                StepType.WAIT, "SpindexerFeed", 0, Constants.SelfTest.FEED_PAUSE_SEC, ""));

        stepDefs.add(new StepDef("feed_rev", "SpindexerFeed: Reverse",
                String.format("Run at %.0f%% reverse for %.1f s",
                        Constants.SelfTest.FEED_REV_OUTPUT * 100, Constants.SelfTest.FEED_RUN_SEC),
                StepType.MOTOR_RUN, "SpindexerFeed",
                -Constants.SelfTest.FEED_REV_OUTPUT, Constants.SelfTest.FEED_RUN_SEC, ""));

        stepDefs.add(new StepDef("feed_stop", "SpindexerFeed: Coast-down",
                "Motor stop and settle",
                StepType.WAIT, "SpindexerFeed", 0, Constants.SelfTest.COAST_DOWN_SEC, ""));

        // Generated Elevator self-test. TODO: replace the generated movement with the real mechanism-safe action.
        if (Constants.Elevator.SELF_TEST_ENABLED) {
            stepDefs.add(new StepDef("elevator_run", "Elevator: Generated Movement",
                    String.format("Generated default: %s Run %.2f for %.1f s", Constants.Elevator.SELF_TEST_TODO, Constants.Elevator.SELF_TEST_OUTPUT, Constants.Elevator.SELF_TEST_DURATION_SEC),
                    StepType.MOTOR_RUN, "Elevator",
                    Constants.Elevator.SELF_TEST_OUTPUT, Constants.Elevator.SELF_TEST_DURATION_SEC, ""));
            stepDefs.add(new StepDef("elevator_stop", "Elevator: Stop",
                    "Stop generated self-test movement and settle",
                    StepType.WAIT, "Elevator", 0, Constants.SelfTest.COAST_DOWN_SEC, ""));
        }


        // 5. Post-run temperature snapshot
        stepDefs.add(new StepDef("health_temps", "Motor Temperatures",
                "Snapshot device temperatures after all motor runs — check for overheating",
                StepType.HEALTH_CHECK, "", 0, 0, ""));

        // 6. Gyro check (interactive)
        stepDefs.add(new StepDef("gyro", "Gyro Check",
                String.format("Physically rotate the robot at least %.0f° to verify the gyro/IMU responds",
                        Constants.SelfTest.GYRO_MIN_DELTA_DEG),
                StepType.GYRO_CHECK, "", 0, Constants.SelfTest.GYRO_TIMEOUT_SEC,
                String.format("Rotate the robot at least %.0f° in any direction, then press Confirm.",
                        Constants.SelfTest.GYRO_MIN_DELTA_DEG)));

        // 7. Vision check (interactive)
        stepDefs.add(new StepDef("vision", "Vision Check",
                "Present an AprilTag to each camera and confirm detection on the driver station",
                StepType.VISION_CHECK, "", 0, Constants.SelfTest.VISION_TIMEOUT_SEC,
                "Hold an AprilTag in front of each camera (Helios Left, Right, Front, Back) " +
                        "and verify the driver station detects targets. Press Confirm when done."));
    }

    // ── WPILib Command lifecycle ──────────────────────────────────────────────

    @Override
    public void initialize() {
        if (!DriverStation.isEnabled()) {
            aborted = true;
            statePublisher.set("aborted");
            return;
        }

        aborted = false;
        stepIndex = 0;
        firstEntry = true;

        // Snapshot starting sentinel values so we don't fire on stale NT data
        lastAbortRequest = abortRequestSub.get(-1.0);
        lastUserConfirm = userConfirmSub.get(-1.0);
        lastUserSkip = userSkipSub.get(-1.0);
        lastUserFail = userFailSub.get(-1.0);

        // Fresh results for this run
        stepResults = new ArrayList<>(stepDefs.size());
        for (StepDef def : stepDefs)
            stepResults.add(new StepResult(def));

        statePublisher.set("running");
        stepCountPublisher.set(stepDefs.size());
        promptPublisher.set("");
        publishResults();
        publishStepHeader(0);
    }

    @Override
    public void execute() {
        if (aborted || stepIndex < 0 || stepIndex >= stepDefs.size())
            return;

        // ── Abort check ──────────────────────────────────────────────────────
        double abortReq = abortRequestSub.get(-1.0);
        if (abortReq > 0 && abortReq != lastAbortRequest) {
            lastAbortRequest = abortReq;
            abortTest("Aborted by operator");
            return;
        }

        // ── Safety: robot disabled mid-test ─────────────────────────────────
        if (!DriverStation.isEnabled()) {
            abortTest("Robot disabled during test");
            return;
        }

        // ── Live scalars (cheap — publish every cycle) ───────────────────────
        liveBatteryPublisher.set(RobotController.getBatteryVoltage());
        double activeCurrent = getSubsystemCurrent(stepDefs.get(stepIndex).subsystem);
        double activeTemp = getSubsystemTemp(stepDefs.get(stepIndex).subsystem);
        liveCurrentPublisher.set(activeCurrent);
        liveTempPublisher.set(activeTemp);

        // ── Execute current step ─────────────────────────────────────────────
        StepDef def = stepDefs.get(stepIndex);
        StepResult result = stepResults.get(stepIndex);

        if (firstEntry) {
            firstEntry = false;
            result.status = StepStatus.RUNNING;
            stepTimer.reset();
            stepTimer.start();
            onStepEnter(def, result);
            publishStepHeader(stepIndex);
        }

        boolean done = executeStep(def, result);

        // Live detail update (string already set inside executeStep for motor runs)
        stepDetailPublisher.set(result.detail);

        if (done) {
            onStepExit(def);
            publishStepHeader(stepIndex);
            publishResults(); // only on transitions
            advanceStep();
        }
    }

    @Override
    public boolean isFinished() {
        return aborted || stepIndex >= stepDefs.size();
    }

    @Override
    public void end(boolean interrupted) {
        stopAllMotors();
        promptPublisher.set("");
        if (interrupted && !aborted) {
            // Mark current step aborted
            if (stepIndex >= 0 && stepIndex < stepDefs.size()) {
                StepResult r = stepResults.get(stepIndex);
                if (r.status == StepStatus.RUNNING) {
                    r.status = StepStatus.FAIL;
                    r.detail = "Robot disabled / command cancelled";
                }
            }
            statePublisher.set("aborted");
        } else if (!aborted) {
            statePublisher.set("done");
        }
        stepIndexPublisher.set(-1);
        if (stepResults != null)
            publishResults();
    }

    // ── Step entry / exit hooks ───────────────────────────────────────────────

    private void onStepEnter(StepDef def, StepResult result) {
        switch (def.type) {
            case MOTOR_RUN:
                commandMotor(def.subsystem, def.testOutput);
                break;
            case WAIT:
                commandMotor(def.subsystem, 0);
                break;
            case GYRO_CHECK:
                stopAllMotors();
                gyroInitialDeg = getHeadingDeg();
                publishPrompt(def.prompt);
                statePublisher.set("waiting_user");
                break;
            case VISION_CHECK:
                stopAllMotors();
                publishPrompt(def.prompt);
                statePublisher.set("waiting_user");
                break;
            case HEALTH_CHECK:
                // Nothing to set up — runs synchronously in executeStep
                break;
        }
    }

    private void onStepExit(StepDef def) {
        switch (def.type) {
            case MOTOR_RUN:
            case WAIT:
                commandMotor(def.subsystem, 0);
                break;
            case GYRO_CHECK:
            case VISION_CHECK:
                promptPublisher.set("");
                statePublisher.set("running");
                break;
            default:
                break;
        }
    }

    // ── Step execution logic ──────────────────────────────────────────────────

    /** Returns true when the step is complete. */
    private boolean executeStep(StepDef def, StepResult result) {
        switch (def.type) {
            case HEALTH_CHECK:
                return executeHealthCheck(def, result);
            case MOTOR_RUN:
                return executeMotorRun(def, result);
            case WAIT:
                return executeWait(def, result);
            case GYRO_CHECK:
                return executeGyroCheck(def, result);
            case VISION_CHECK:
                return executeVisionCheck(def, result);
            default:
                result.status = StepStatus.SKIPPED;
                result.detail = "Unknown step type";
                return true;
        }
    }

    private boolean executeHealthCheck(StepDef def, StepResult result) {
        List<RobotHealthMonitor.DeviceSnapshot> devs = healthMonitor.getDeviceSnapshots();

        switch (def.id) {
            case "health_battery": {
                double v = RobotController.getBatteryVoltage();
                result.detail = String.format("%.2f V", v);
                if (v < Constants.SelfTest.BATTERY_MIN_V) {
                    result.status = StepStatus.FAIL;
                    result.detail += " — critically low, charge before testing";
                } else if (v < 11.5) {
                    result.status = StepStatus.WARNING;
                    result.detail += " — low";
                } else {
                    result.status = StepStatus.PASS;
                }
                break;
            }
            case "health_can": {
                long offline = devs.stream().filter(d -> !d.online).count();
                if (offline == 0) {
                    result.status = StepStatus.PASS;
                    result.detail = devs.size() + " device(s) online";
                } else {
                    result.status = StepStatus.FAIL;
                    result.detail = offline + "/" + devs.size() + " device(s) offline";
                }
                break;
            }
            case "health_faults": {
                long active = devs.stream().filter(d -> !d.activeFaults.isEmpty()).count();
                long sticky = devs.stream().filter(d -> !d.stickyFaults.isEmpty()).count();
                if (active == 0 && sticky == 0) {
                    result.status = StepStatus.PASS;
                    result.detail = "No faults on " + devs.size() + " device(s)";
                } else if (active == 0) {
                    result.status = StepStatus.WARNING;
                    result.detail = sticky + " device(s) with sticky faults";
                } else {
                    result.status = StepStatus.FAIL;
                    result.detail = active + " device(s) with active faults";
                }
                break;
            }
            case "health_temps": {
                double maxT = devs.stream().mapToDouble(d -> d.temperatureC).max().orElse(0.0);
                String hotDev = devs.stream().filter(d -> d.temperatureC == maxT)
                        .map(d -> d.subsystem + "/" + d.name).findFirst().orElse("?");
                result.peakTempC = maxT;
                result.detail = String.format("Max %.0f°C (%s)", maxT, hotDev);
                if (maxT >= Constants.SelfTest.TEMP_ABORT_C) {
                    result.status = StepStatus.FAIL;
                    result.detail += " — critical";
                } else if (maxT >= Constants.SelfTest.TEMP_WARN_C) {
                    result.status = StepStatus.WARNING;
                    result.detail += " — warm";
                } else {
                    result.status = StepStatus.PASS;
                }
                break;
            }
            default:
                result.status = StepStatus.SKIPPED;
                result.detail = "Unknown health check id";
        }
        return true; // instant
    }

    private boolean executeMotorRun(StepDef def, StepResult result) {
        double elapsed = stepTimer.get();
        double current = getSubsystemCurrent(def.subsystem);
        double temp = getSubsystemTemp(def.subsystem);

        if (current > result.peakCurrentA)
            result.peakCurrentA = current;
        if (temp > result.peakTempC)
            result.peakTempC = temp;

        // Safety abort on overcurrent or overtemp
        if (current > Constants.SelfTest.CURRENT_ABORT_A) {
            commandMotor(def.subsystem, 0);
            result.status = StepStatus.FAIL;
            result.detail = String.format("Overcurrent %.1f A at %.1f s (limit %.0f A)",
                    current, elapsed, Constants.SelfTest.CURRENT_ABORT_A);
            return true;
        }
        if (temp >= Constants.SelfTest.TEMP_ABORT_C) {
            commandMotor(def.subsystem, 0);
            result.status = StepStatus.FAIL;
            result.detail = String.format("Overtemp %.0f°C at %.1f s (limit %.0f°C)",
                    temp, elapsed, Constants.SelfTest.TEMP_ABORT_C);
            return true;
        }

        // Live detail (published by execute() caller)
        double remain = Math.max(0, def.durationSec - elapsed);
        stepTimeRemainPublisher.set(remain);
        result.detail = String.format("%.1f s left — %.1f A (peak %.1f A), %.0f°C",
                remain, current, result.peakCurrentA, temp);

        if (elapsed >= def.durationSec) {
            result.status = (result.peakCurrentA > Constants.SelfTest.CURRENT_WARN_A
                    || result.peakTempC >= Constants.SelfTest.TEMP_WARN_C)
                            ? StepStatus.WARNING
                            : StepStatus.PASS;
            result.detail = String.format("Peak: %.1f A, %.0f°C", result.peakCurrentA, result.peakTempC);
            if (result.status == StepStatus.WARNING)
                result.detail += " — threshold exceeded";
            return true;
        }
        return false;
    }

    private boolean executeWait(StepDef def, StepResult result) {
        double elapsed = stepTimer.get();
        double remain = Math.max(0, def.durationSec - elapsed);
        stepTimeRemainPublisher.set(remain);
        result.detail = String.format("%.1f s remaining", remain);
        if (elapsed >= def.durationSec) {
            result.status = StepStatus.PASS;
            result.detail = "Done";
            return true;
        }
        return false;
    }

    private boolean executeGyroCheck(StepDef def, StepResult result) {
        // Simulation: auto-pass — the physical gyro won't change in sim
        if (RobotBase.isSimulation()) {
            result.status = StepStatus.PASS;
            result.detail = "Auto-confirmed in simulation";
            return true;
        }

        double currentDeg = getHeadingDeg();
        double delta = Math.abs(currentDeg - gyroInitialDeg);
        if (delta > 180)
            delta = 360 - delta; // shortest arc

        double remain = Math.max(0, def.durationSec - stepTimer.get());
        stepTimeRemainPublisher.set(remain);
        result.detail = String.format("%.1f° rotated (need %.0f°) — %.0f s left",
                delta, Constants.SelfTest.GYRO_MIN_DELTA_DEG, remain);

        // Check user responses
        if (isUserConfirm()) {
            result.status = delta >= Constants.SelfTest.GYRO_MIN_DELTA_DEG
                    ? StepStatus.PASS
                    : StepStatus.WARNING;
            result.detail = String.format("Confirmed by operator — %.1f° delta detected", delta);
            return true;
        }
        if (isUserSkip()) {
            result.status = StepStatus.SKIPPED;
            result.detail = "Skipped by operator";
            return true;
        }
        if (isUserFail()) {
            result.status = StepStatus.FAIL;
            result.detail = "Marked failed by operator — check gyro wiring/firmware";
            return true;
        }

        // Timeout
        if (stepTimer.get() >= def.durationSec) {
            result.status = StepStatus.WARNING;
            result.detail = String.format("Timed out — only %.1f° detected, need %.0f°",
                    delta, Constants.SelfTest.GYRO_MIN_DELTA_DEG);
            return true;
        }
        return false;
    }

    private boolean executeVisionCheck(StepDef def, StepResult result) {
        // Simulation: auto-pass
        if (RobotBase.isSimulation()) {
            result.status = StepStatus.PASS;
            result.detail = "Auto-confirmed in simulation";
            return true;
        }

        double remain = Math.max(0, def.durationSec - stepTimer.get());
        stepTimeRemainPublisher.set(remain);
        result.detail = String.format("Waiting for operator — %.0f s left", remain);

        if (isUserConfirm()) {
            result.status = StepStatus.PASS;
            result.detail = "Vision confirmed by operator";
            return true;
        }
        if (isUserSkip()) {
            result.status = StepStatus.SKIPPED;
            result.detail = "Skipped by operator";
            return true;
        }
        if (isUserFail()) {
            result.status = StepStatus.FAIL;
            result.detail = "Marked failed by operator — check camera connections";
            return true;
        }

        if (stepTimer.get() >= def.durationSec) {
            result.status = StepStatus.WARNING;
            result.detail = "Timed out without operator confirmation";
            return true;
        }
        return false;
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    private void advanceStep() {
        stepIndex++;
        firstEntry = true;
        stepTimeRemainPublisher.set(0);
        if (stepIndex < stepDefs.size()) {
            publishStepHeader(stepIndex);
        }
    }

    private void abortTest(String reason) {
        aborted = true;
        stopAllMotors();
        promptPublisher.set("");
        if (stepIndex >= 0 && stepIndex < stepDefs.size()) {
            StepResult r = stepResults.get(stepIndex);
            if (r.status == StepStatus.RUNNING) {
                r.status = StepStatus.FAIL;
                r.detail = reason;
            }
        }
        statePublisher.set("aborted");
        publishResults();
    }

    // ── Motor control helpers ─────────────────────────────────────────────────

    private void stopAllMotors() {
        elevator.stopSelfTest();
        intake.stopSelfTest();
        spindexerFeed.stopSelfTest();
        spindexerHook.stopSelfTest();
        intake.setOutput(0);
        spindexerFeed.setOutput(0);
        spindexerHook.setTargetVelocity(0);
    }

    private void commandMotor(String subsystem, double value) {
        switch (subsystem) {
            case "Intake":
                intake.setOutput(value);
                break;
            case "SpindexerFeed":
                spindexerFeed.setOutput(value);
                break;
            case "SpindexerHook":
                spindexerHook.setTargetVelocity(value);
                break;
            case "Elevator":
                elevator.runSelfTest(value);
                break;
            default: /* no motor for this step */
        }
    }

    private double getSubsystemCurrent(String subsystem) {
        switch (subsystem) {
            case "Intake":
                return intake.getSupplyCurrentA();
            case "SpindexerFeed":
                return spindexerFeed.getSupplyCurrentA();
            case "SpindexerHook":
                return spindexerHook.getSupplyCurrentA();
            case "Elevator":
                return elevator.getSupplyCurrentA();
            default:
                return 0.0;
        }
    }

    private double getSubsystemTemp(String subsystem) {
        switch (subsystem) {
            case "Intake":
                return intake.getTemperatureC();
            case "SpindexerFeed":
                return spindexerFeed.getTemperatureC();
            case "SpindexerHook":
                return spindexerHook.getTemperatureC();
            case "Elevator":
                return elevator.getTemperatureC();
            default:
                return 0.0;
        }
    }

    // ── Sensor helpers ────────────────────────────────────────────────────────

    private double getHeadingDeg() {
        return drivetrain.getState().Pose.getRotation().getDegrees();
    }

    // ── User-response helpers (rising-edge detection) ─────────────────────────

    private boolean isUserConfirm() {
        double v = userConfirmSub.get(-1.0);
        if (v > 0 && v != lastUserConfirm) {
            lastUserConfirm = v;
            return true;
        }
        return false;
    }

    private boolean isUserSkip() {
        double v = userSkipSub.get(-1.0);
        if (v > 0 && v != lastUserSkip) {
            lastUserSkip = v;
            return true;
        }
        return false;
    }

    private boolean isUserFail() {
        double v = userFailSub.get(-1.0);
        if (v > 0 && v != lastUserFail) {
            lastUserFail = v;
            return true;
        }
        return false;
    }

    // ── NT publish helpers ────────────────────────────────────────────────────

    private void publishPrompt(String text) {
        promptPublisher.set(text);
    }

    private void publishStepHeader(int idx) {
        if (idx < 0 || idx >= stepDefs.size())
            return;
        StepDef def = stepDefs.get(idx);
        StepResult result = stepResults.get(idx);
        stepIndexPublisher.set(idx);
        stepNamePublisher.set(def.label);
        stepTypePublisher.set(def.type.name());
        stepStatusPublisher.set(result.status.name().toLowerCase());
        stepDetailPublisher.set(result.detail);
    }

    /**
     * Serialise all step results to JSON and push to NT. Only call on transitions.
     */
    private void publishResults() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < stepResults.size(); i++) {
            if (i > 0)
                sb.append(",");
            sb.append(stepResults.get(i).toJson());
        }
        resultsPublisher.set(sb.append("]").toString());
    }
}
