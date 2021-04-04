import React from 'react';
import PropTypes from 'prop-types';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';
import { Form } from '@edx/paragon';
import messages from './messages';

function BlackoutDatesField({
  onBlur,
  onChange,
  intl,
  values,
}) {
  return (
    <>
      <h5 className="mb-3">{intl.formatMessage(messages.blackoutDates)}</h5>
      <Form.Group
        controlId="blackoutDates"
      >
        <Form.Control
          value={values.blackoutDates}
          onChange={onChange}
          onBlur={onBlur}
          floatingLabel={intl.formatMessage(messages.blackoutDatesLabel)}
        />
        <Form.Text muted>
          {intl.formatMessage(messages.blackoutDatesHelp)}
        </Form.Text>
      </Form.Group>
    </>
  );
}

BlackoutDatesField.propTypes = {
  onBlur: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  values: PropTypes.shape({
    blackoutDates: PropTypes.string,
  }).isRequired,
};

export default injectIntl(BlackoutDatesField);