import React from 'react';
import { parseAssistantBlocks, splitBoldSegments } from './assistantFormat';

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] =>
  splitBoldSegments(text).map((segment, index) => {
    const key = `${keyPrefix}-${index}`;
    return segment.bold ? (
      <strong key={key} className="font-semibold text-gray-900 dark:text-white">
        {segment.text}
      </strong>
    ) : (
      <React.Fragment key={key}>{segment.text}</React.Fragment>
    );
  });

export const AssistantText: React.FC<{ content: string }> = ({ content }) => {
  const blocks = parseAssistantBlocks(content);

  if (blocks.length === 0) {
    return <p>{content}</p>;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) =>
        block.type === 'list' ? (
          <ul key={`block-${blockIndex}`} className="space-y-1">
            {block.items.map((item, itemIndex) => (
              <li key={`block-${blockIndex}-item-${itemIndex}`} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-40"
                />
                <span className="min-w-0 flex-1">
                  {renderInline(item, `block-${blockIndex}-item-${itemIndex}`)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={`block-${blockIndex}`}>{renderInline(block.text, `block-${blockIndex}`)}</p>
        ),
      )}
    </div>
  );
};

export default AssistantText;
