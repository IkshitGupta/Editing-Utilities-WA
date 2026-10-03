import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('shows its label and responds to a tap', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save photo" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Save photo'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores taps while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save photo" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByText('Save photo'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
