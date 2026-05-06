package com.team3544.lib.state;

import com.team3544.lib.nt.NTManager;

/**
 * Generic abstract state machine base class.
 *
 * <p>Subclass this and provide concrete implementations of {@link #onEnter(Object)}
 * and {@link #onExit(Object)} to react to state transitions.
 *
 * <p>State transitions are logged via {@link NTManager} under
 * {@code /3544/StateMachine/<className>/State}.
 *
 * @param <S> the state enum or type
 */
public abstract class StateMachine<S> {

    private S currentState;
    private final String ntKey;

    /**
     * @param initialState the state the machine starts in
     */
    protected StateMachine(S initialState) {
        this.currentState = initialState;
        this.ntKey = "StateMachine/" + getClass().getSimpleName() + "/State";
        NTManager.logString(ntKey, currentState.toString());
    }

    /**
     * Called after the machine enters {@code state}.
     *
     * @param state the state that was just entered
     */
    protected abstract void onEnter(S state);

    /**
     * Called before the machine exits {@code state}.
     *
     * @param state the state about to be exited
     */
    protected abstract void onExit(S state);

    /**
     * Transitions to {@code newState}. If {@code newState} equals the current state,
     * this is a no-op. Calls {@link #onExit} on the old state and {@link #onEnter}
     * on the new state, then logs the transition over NT.
     *
     * @param newState the state to transition into
     */
    public void transition(S newState) {
        if (newState == null || newState.equals(currentState)) {
            return;
        }
        S previous = currentState;
        onExit(previous);
        currentState = newState;
        onEnter(currentState);
        NTManager.logString(ntKey, currentState.toString());
    }

    /**
     * Returns the current state.
     */
    public S getState() {
        return currentState;
    }
}
