import React from "react";
import {Box, Text} from "ink";
import {useApproval} from "../approval/ApprovalContext";

const ApprovalDemo: React.FC = () => {
  const {requestApproval} = useApproval();
  const [result, setResult] = React.useState<string|null>(null);

  React.useEffect(() => {
    (async () => {
      const res = await requestApproval(
        "Do you approve running this potentially dangerous operation?",
        {key: "dangerous-op"}
      );
      setResult(`Approved: ${res.approved} (alwaysAllow: ${!!res.alwaysAllow})`);
    })();
  }, []);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>Approval Demo Command</Text>
      <Text color="yellow">{result ? result : "Waiting for approval..."}</Text>
    </Box>
  );
};

export default ApprovalDemo;
