import React, {useState} from "react";
import {Box, Text} from "ink";
import {useInput} from "ink";

interface Props {
  prompt: string;
  onRespond: (result:{approved:boolean; alwaysAllow?:boolean})=>void;
}

const options = [
  {label: "Approve", result: {approved: true}},
  {label: "Deny", result: {approved: false}},
  {label: "Always allow for session", result: {approved: true, alwaysAllow: true}},
];

const ApprovalPrompt: React.FC<Props> = ({prompt, onRespond}) => {
  const [selected, setSelected] = useState(0);

  useInput((input,key) => {
    if (key.upArrow) setSelected(prev => prev === 0 ? options.length - 1 : prev - 1);
    if (key.downArrow) setSelected(prev => prev === options.length - 1 ? 0 : prev + 1);
    if (key.return) {
      onRespond(options[selected].result);
    }
  });

  return (
    <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column" width={60}>
      <Text color="cyanBright">{prompt}</Text>
      <Box flexDirection="column">
        {options.map((opt, idx) => (
          <Text key={opt.label} color={idx===selected ? "magentaBright":undefined}>
            {idx===selected ? "›" : "  " } {opt.label}
          </Text>
        ))}
      </Box>
      <Text> </Text> {/* Spacer for margin */}
      <Text dimColor>Use ↑/↓ to select, Enter to confirm.</Text>
    </Box>
  );
};

export default ApprovalPrompt;
