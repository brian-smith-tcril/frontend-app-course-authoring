import 'CourseAuthoring/editors/setupEditorTest';
import React from 'react';
import { shallow } from '@edx/react-unit-test-utils';

import { formatMessage } from '../../../../testUtils';
import { EditorFooterInternal as EditorFooter } from '.';

jest.mock('../../hooks', () => ({
  nullMethod: jest.fn().mockName('hooks.nullMethod'),
}));

describe('EditorFooter', () => {
  const props = {
    intl: { formatMessage },
    disableSave: false,
    onCancel: jest.fn().mockName('args.onCancel'),
    onSave: jest.fn().mockName('args.onSave'),
    saveFailed: false,
  };
  describe('render', () => {
    test('snapshot: default args (disableSave: false, saveFailed: false)', () => {
      expect(shallow(<EditorFooter {...props} />).snapshot).toMatchSnapshot();
    });

    test('snapshot: save disabled. Show button spinner', () => {
      expect(shallow(<EditorFooter {...props} disableSave />).snapshot).toMatchSnapshot();
    });

    test('snapshot: save failed.  Show error message', () => {
      expect(shallow(<EditorFooter {...props} saveFailed />).snapshot).toMatchSnapshot();
    });
  });
});
