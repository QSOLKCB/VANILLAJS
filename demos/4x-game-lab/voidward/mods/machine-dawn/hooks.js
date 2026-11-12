// SPDX-License-Identifier: Apache-2.0
// A working source-mod example. Hooks receive the candidate state and engine API.
// Use JSON data, the engine's turn counter and seeded orders; never ambient clocks.
export default {
  onCreate(state, api) {
    state.modState.supplyDelivered = false;
    api.log(state, 'Network reboot complete. Establish six archives to secure the Free Nodes.', 'info');
  },
  onTurn(state, api) {
    if (state.turn === 8 && !state.modState.supplyDelivered) {
      state.modState.supplyDelivered = true;
      for (const empire of state.empires) empire.minerals = Math.min(999999, empire.minerals + 100);
      api.log(state, 'A dormant fabrication network wakes. Every civilisation receives 100 minerals.', 'relic');
    }
  }
};
