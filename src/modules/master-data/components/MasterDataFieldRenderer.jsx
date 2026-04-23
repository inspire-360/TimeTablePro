import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { ColorTokenField } from './ColorTokenField';
import { TextareaField } from './TextareaField';

export function MasterDataFieldRenderer({
  context,
  field,
  form,
  onChange,
}) {
  const value = form[field.name] ?? '';
  const options = field.options || field.getOptions?.(context) || [];
  const helperText = field.getHelperText?.(context) || '';

  function updateValue(nextValue) {
    onChange(field.name, nextValue);
  }

  let control = null;

  if (field.type === 'select') {
    control = (
      <SelectField
        label={field.label}
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        disabled={field.disabled}
      >
        <option value="">{field.placeholder || 'Select option'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
    );
  } else if (field.type === 'textarea') {
    control = (
      <TextareaField
        label={field.label}
        rows={field.rows || 4}
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        placeholder={field.placeholder}
        readOnly={field.readOnly}
      />
    );
  } else if (field.type === 'palette') {
    control = (
      <ColorTokenField
        label={field.label}
        options={options}
        value={value}
        onChange={updateValue}
      />
    );
  } else {
    control = (
      <InputField
        label={field.label}
        type={field.type || 'text'}
        min={field.min}
        max={field.max}
        step={field.step}
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        placeholder={field.placeholder}
        readOnly={field.readOnly}
      />
    );
  }

  return (
    <div className={field.fullWidth ? 'settings-grid__full' : ''}>
      {control}
      {helperText ? <p className="plc-helper-text">{helperText}</p> : null}
    </div>
  );
}
