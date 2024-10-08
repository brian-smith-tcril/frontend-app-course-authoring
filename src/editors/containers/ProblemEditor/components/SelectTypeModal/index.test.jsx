import 'CourseAuthoring/editors/setupEditorTest';
import React from 'react';
import { shallow } from '@edx/react-unit-test-utils';
import SelectTypeModal from '.';

jest.mock('./hooks', () => ({
  selectHooks: jest.fn(() => ({
    selected: 'mOcKsELEcted',
    setSelected: jest.fn().mockName('setSelected'),
  })),
  useArrowNav: jest.fn().mockName('useArrowNav'),
}));

describe('SelectTypeModal', () => {
  const props = {
    onClose: jest.fn(),
  };

  test('snapshot', () => {
    expect(shallow(<SelectTypeModal {...props} />).snapshot).toMatchSnapshot();
  });
});
