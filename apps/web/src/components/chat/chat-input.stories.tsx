import type { Meta, StoryObj } from '@storybook/react-vite';
import ChatInput from './chat-input';

const meta: Meta<typeof ChatInput> = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  decorators: [
    (Story) => (
      <div style={{ width: 600 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ChatInput>;

export const Default: Story = {
  args: { onSend: (msg: string) => console.log('Sent:', msg) },
};
