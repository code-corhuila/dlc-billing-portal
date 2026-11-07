# PDF after payments

The current invoice PDF is available for ISSUED, PARTIALLY_PAID and PAID states.
The detail button and composition guard use the same permitted states; drafts
remain excluded by the existing Portal flow. Staff authorization, HTTP mode,
in-flight guards and stale-route checks are preserved.

RED: four failures reproduced paid-state denial in component/composition tests.
GREEN: all 589 tests passed. Contract check and build:portal passed with the new
immutable local release 2.0.1-local-20261107. No old release was overwritten.
Browser acceptance is verified separately against real owner services.
