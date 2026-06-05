# Design Document: Add shadcn/ui Select Component

## Overview

This design adds a shadcn/ui Select component to the Better Sidebar extension, replacing native HTML select elements with a consistent, accessible, and themeable dropdown component based on @radix-ui/react-select. The implementation follows the shadcn/ui "new-york" style pattern and integrates with the existing Tailwind CSS variable-based theme system.

The Select component will be composed of multiple sub-components (SelectTrigger, SelectContent, SelectItem, etc.) following Radix UI's composition pattern, allowing flexible usage throughout the application while maintaining visual consistency with existing form components.

## Architecture

### Component Structure

The Select component follows the shadcn/ui pattern of wrapping Radix UI primitives with styled components:

```
Select (Root)
├── SelectTrigger (Button-like trigger)
│   └── SelectValue (Displays selected value or placeholder)
├── SelectContent (Dropdown portal)
│   └── SelectViewport
│       ├── SelectGroup (Optional grouping)
│       │   └── SelectLabel (Group label)
│       └── SelectItem (Individual options)
│           ├── SelectItemText
│           └── SelectItemIndicator (Check icon)
└── SelectScrollUpButton / SelectScrollDownButton (Optional scroll buttons)
```

### Integration Points

1. **VariableFillForm**: The primary consumer, replacing native select elements for dropdown variables
2. **Theme System**: Integrates with CSS variables defined in `tailwind.config.js`
3. **UI Component Library**: Lives alongside other form components in `src/shared/components/ui/`
4. **Radix UI**: Depends on @radix-ui/react-select for accessibility and behavior

### File Organization

```
src/shared/components/ui/
├── select.tsx          # New Select component
├── input.tsx           # Existing (for style reference)
├── label.tsx           # Existing (for style reference)
└── ...

src/entrypoints/overlay.content/shared/modules/prompts/components/
└── VariableFillForm.tsx  # Updated to use Select
```

## Components and Interfaces

### Select Component API

The Select component exports the following sub-components:

**Select (Root)**
```typescript
interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  // Inherits: value, defaultValue, onValueChange, open, defaultOpen, onOpenChange, disabled, name, required
}
```

**SelectTrigger**
```typescript
interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  className?: string;
  // Inherits: disabled, asChild
}
```

**SelectContent**
```typescript
interface SelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  className?: string;
  position?: "popper" | "item-aligned";
  // Inherits: onCloseAutoFocus, onEscapeKeyDown, onPointerDownOutside
}
```

**SelectItem**
```typescript
interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  className?: string;
  // Inherits: value, disabled, textValue
}
```

**SelectValue**
```typescript
interface SelectValueProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value> {
  placeholder?: string;
}
```

### VariableFillForm Integration

The VariableFillForm component will be updated to use the Select component:

**Before (native select):**
```typescript
<select
  value={values[variable.name] || variable.defaultValue || ""}
  onChange={(e) => handleChange(variable.name, e.target.value)}
  className="..."
>
  {variable.options?.map((option) => (
    <option key={option} value={option}>
      {option}
    </option>
  ))}
</select>
```

**After (Select component):**
```typescript
<Select
  value={values[variable.name] || variable.defaultValue || ""}
  onValueChange={(value) => handleChange(variable.name, value)}
>
  <SelectTrigger className="...">
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    {variable.options?.map((option) => (
      <SelectItem key={option} value={option}>
        {option}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Data Models

No new data models are required. The Select component works with primitive string values and integrates with the existing VariableFillForm state management:

```typescript
// Existing VariableFillForm state
interface VariableValues {
  [variableName: string]: string;
}

// Existing variable definition
interface PromptVariable {
  name: string;
  type: "text" | "textarea" | "dropdown";
  defaultValue?: string;
  options?: string[];  // Used for dropdown type
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Component exports are valid

*For any* import of the Select module, all exported sub-components (Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup) should be defined and renderable without errors.

**Validates: Requirements 2.5**

### Property 2: Ref forwarding works correctly

*For any* ref object passed to SelectTrigger, SelectContent, or SelectItem, the ref should be attached to the underlying DOM element after rendering.

**Validates: Requirements 2.6**

### Property 3: Keyboard navigation is functional

*For any* rendered Select component, keyboard interactions (ArrowDown, ArrowUp, Enter, Escape, Tab) should trigger the appropriate navigation and selection behaviors.

**Validates: Requirements 4.1**

### Property 4: ARIA attributes are present

*For any* rendered Select component, the required ARIA attributes (role, aria-expanded, aria-controls, aria-labelledby) should be present in the DOM for accessibility.

**Validates: Requirements 4.2**

### Property 5: VariableFillForm uses Select component

*For any* VariableFillForm rendered with dropdown-type variables, the output should contain Select components and not contain native HTML select elements.

**Validates: Requirements 5.1**

### Property 6: Default values are selected

*For any* variable with a defaultValue in VariableFillForm, rendering the form should display that default value as selected in the corresponding Select component.

**Validates: Requirements 5.2**

### Property 7: onChange handler is called

*For any* variable in VariableFillForm, when the user changes the selection in the Select component, the onChange handler should be invoked with the new value.

**Validates: Requirements 5.3**

### Property 8: All options are rendered

*For any* variable with an options array in VariableFillForm, all options should appear as SelectItem elements in the rendered dropdown.

**Validates: Requirements 5.4**

### Property 9: HTML attributes are applied

*For any* standard HTML select attribute (disabled, name, required) passed to the Select component, the attribute should be applied to the underlying Radix primitive.

**Validates: Requirements 6.1**

### Property 10: Custom className is applied

*For any* custom className string passed to SelectTrigger, SelectContent, or SelectItem, the class should be present in the rendered element's className.

**Validates: Requirements 6.3**

## Error Handling

### Component-Level Errors

1. **Missing required props**: Select component should handle missing value/defaultValue gracefully
2. **Invalid option values**: SelectItem should handle undefined or null values without crashing
3. **Empty options array**: VariableFillForm should render an empty Select without errors

### Integration Errors

1. **Ref forwarding failures**: If ref forwarding fails, component should still render (degraded but functional)
2. **Theme variable missing**: Component should fall back to default Tailwind colors if CSS variables are undefined
3. **Keyboard event conflicts**: Select should handle cases where keyboard events are prevented by parent components

### Error Recovery

- All errors should be caught at component boundaries to prevent full application crashes
- Console warnings should be logged for development debugging
- Components should render in a degraded but functional state when non-critical errors occur

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of Select component usage (controlled, uncontrolled, disabled)
- Edge cases (empty options, undefined values, missing props)
- Integration with VariableFillForm (specific variable configurations)
- Error conditions (invalid props, missing required children)

**Property Tests** focus on:
- Universal properties across all possible inputs (ref forwarding, className application)
- Keyboard navigation behavior across different component states
- ARIA attribute presence across all rendering scenarios
- VariableFillForm behavior across all variable configurations

### Property-Based Testing Configuration

- **Library**: fast-check (TypeScript property-based testing library)
- **Minimum iterations**: 100 runs per property test
- **Tagging format**: Each property test must include a comment:
  ```typescript
  // Feature: add-shadcn-select-component, Property 2: Ref forwarding works correctly
  ```

### Test Organization

```
src/shared/components/ui/__tests__/
├── select.test.tsx              # Unit tests for Select component
└── select.properties.test.tsx   # Property-based tests

src/entrypoints/overlay.content/shared/modules/prompts/components/__tests__/
├── VariableFillForm.test.tsx              # Unit tests for form integration
└── VariableFillForm.properties.test.tsx   # Property-based tests
```

### Key Test Scenarios

**Unit Tests:**
1. Select renders with default value
2. Select renders in disabled state
3. Select renders with placeholder
4. SelectContent opens on trigger click
5. SelectItem selection updates value
6. VariableFillForm renders with dropdown variables
7. VariableFillForm handles empty options array
8. VariableFillForm preserves existing text/textarea inputs

**Property Tests:**
1. Ref forwarding (Property 2)
2. Keyboard navigation (Property 3)
3. ARIA attributes (Property 4)
4. VariableFillForm uses Select (Property 5)
5. Default values (Property 6)
6. onChange handling (Property 7)
7. All options rendered (Property 8)
8. HTML attributes (Property 9)
9. Custom className (Property 10)

### Testing Tools

- **React Testing Library**: Component rendering and user interaction simulation
- **fast-check**: Property-based test generation
- **@testing-library/user-event**: Realistic user interaction simulation
- **@testing-library/jest-dom**: Enhanced DOM matchers

### Accessibility Testing

- Keyboard navigation tests should verify focus management
- ARIA attribute tests should verify screen reader compatibility
- Focus indicator tests should verify visible focus states (manual verification)
