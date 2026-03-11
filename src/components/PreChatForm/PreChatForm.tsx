import { useState, FormEvent } from 'react'
import type { FieldConfig } from '../../types'

interface PreChatFormProps {
  fields: FieldConfig[]
  title?: string
  subtitle?: string
  initialValues?: Record<string, string>
  onSubmit: (values: Record<string, string>) => void
}

export function PreChatForm({
  fields,
  title = 'Bắt đầu trò chuyện',
  subtitle = 'Vui lòng điền thông tin để tiếp tục',
  initialValues = {},
  onSubmit,
}: PreChatFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(fields.map((f) => [f.name, initialValues[f.name] ?? '']))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    fields.forEach((field) => {
      if (field.required && !values[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} là bắt buộc`
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (validate()) {
      onSubmit(values)
    }
  }

  return (
    <form className="prechat-form" onSubmit={handleSubmit} noValidate>
      <div className="prechat-form__header">
        <h2 className="prechat-form__title">{title}</h2>
        {subtitle && <p className="prechat-form__subtitle">{subtitle}</p>}
      </div>

      <div className="prechat-form__fields">
        {fields.map((field) => (
          <div key={field.name} className="prechat-form__field">
            <label className="prechat-form__label">
              {field.label}
              {field.required && <span className="prechat-form__required">*</span>}
            </label>
            <input
              className={`prechat-form__input ${errors[field.name] ? 'error' : ''}`}
              type={field.type}
              name={field.name}
              value={values[field.name]}
              placeholder={field.placeholder ?? `Nhập ${field.label.toLowerCase()}`}
              onChange={(e) => handleChange(field.name, e.target.value)}
              autoComplete="off"
            />
            {errors[field.name] && (
              <span className="prechat-form__error">{errors[field.name]}</span>
            )}
          </div>
        ))}
      </div>

      <button type="submit" className="prechat-form__submit">
        Bắt đầu chat
      </button>
    </form>
  )
}
