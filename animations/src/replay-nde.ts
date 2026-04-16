import { makeProject } from "@motion-canvas/core";

import replayNDE from "./scenes/replay-nde/replay-nde?scene";

export default makeProject({
  name: "replay-nde",
  scenes: [replayNDE],
});
