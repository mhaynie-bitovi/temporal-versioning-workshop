import { makeProject } from "@motion-canvas/core";

import replayFlow from "./scenes/replay-flow/replay-flow?scene";

export default makeProject({
  name: "replay-flow",
  scenes: [replayFlow],
});
