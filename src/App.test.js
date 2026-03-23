import { render, screen } from '@testing-library/react';
import App from './App';

test('renders AI Signal navbar', () => {
  render(<App />);
  expect(screen.getByText('AI Signal')).toBeInTheDocument();
});
