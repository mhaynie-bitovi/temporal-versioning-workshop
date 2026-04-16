import { makeProject } from "@motion-canvas/core";

import replayFlow from "./scenes/replay-flow/replay-flow?scene";
import replayNDE from "./scenes/replay-nde/replay-nde?scene";

export default makeProject({
  scenes: [replayFlow, replayNDE],
});
