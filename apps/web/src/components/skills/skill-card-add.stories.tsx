import type { Meta, StoryObj } from '@storybook/react-vite';
import SkillCardAdd from './skill-card-add';

const meta: Meta<typeof SkillCardAdd> = {
  title: 'Skills/SkillCardAdd',
  component: SkillCardAdd,
  decorators: [
    (Story) => (
      <div style={{ width: 340 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SkillCardAdd>;

export const Default: Story = {
  args: { onClick: () => console.log('Add skill clicked') },
};
