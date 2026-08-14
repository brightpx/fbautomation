import logger from './logger.js';

/**
 * Process command from comment text
 */
export const processCommand = (commentText, commands, defaultReply) => {
  if (!commentText) {
    return { reply: defaultReply, command: null };
  }

  const text = commentText.trim();

  // Check for commands in the text
  for (const [command, reply] of Object.entries(commands)) {
    if (text.includes(command)) {
      logger.info(`COMMAND DETECTED: ${command}`);
      return { reply, command };
    }
  }

  // No command found, use default reply
  return { reply: defaultReply, command: null };
};

/**
 * Extract all commands from text
 */
export const extractCommands = (text, availableCommands) => {
  const foundCommands = [];
  
  for (const command of Object.keys(availableCommands)) {
    if (text.includes(command)) {
      foundCommands.push(command);
    }
  }
  
  return foundCommands;
};

export default {
  processCommand,
  extractCommands
};
