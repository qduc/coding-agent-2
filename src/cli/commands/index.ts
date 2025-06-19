import React from "react";
import { ApprovalProvider } from "../approval/ApprovalContext";
import ApprovalDemo from "./approvalDemo";

const App: React.FC = () => (
  <ApprovalProvider>
    <ApprovalDemo />
  </ApprovalProvider>
);

export
default App;
 * from '../commands';
