# Implementation Plan: Add shadcn/ui Select Component

## Overview

This implementation adds the shadcn/ui Select component to the Better Sidebar extension by installing @radix-ui/react-select, creating a styled Select component following shadcn/ui patterns, and refactoring VariableFillForm to use it. The implementation follows an incremental approach: install dependencies, create the base component, add sub-components, integrate with VariableFillForm, and validate with tests.

## Tasks

- [x] 1. Install @radix-ui/react-select dependency
  - Run `npm install @radix-ui/react-select`
  - Verify the package is added to package.json
  - _Requirements: 1.1_

- [ ] 2. Create base Select component structure
  - [x] 2.1 Create `src/shared/components/ui/select.tsx` file
    - Import Radix UI Select primitives
    - Set up component exports (Select, SelectTrigger, SelectContent, SelectItem, SelectValue, SelectGroup)
    - Add TypeScript interfaces for component props
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 2.2 Implement SelectTrigger component
    - Wrap SelectPrimitive.Trigger with forwardRef
    - Apply Tailwind classes matching Input component styling (border, padding, focus ring)
    - Support custom className prop via cn() utility
    - _Requirements: 2.4, 2.6, 2.7, 6.3, 7.1, 7.2, 7.3, 7.4_
  
  - [x] 2.3 Implement SelectValue component
    - Wrap SelectPrimitive.Value
    - Support placeholder prop
    - _Requirements: 6.5_
  
  - [ ]* 2.4 Write property test for ref forwarding
    - **Property 2: Ref forwarding works correctly**
    - **Validates: Requirements 2.6**

- [ ] 3. Implement SelectContent and dropdown components
  - [x] 3.1 Implement SelectContent component
    - Wrap SelectPrimitive.Content with forwardRef
    - Apply Portal for proper positioning
    - Add Tailwind classes for elevation, shadow, and border
    - Support position prop (popper/item-aligned)
    - Use CSS variables for theme colors
    - _Requirements: 2.4, 2.6, 3.3, 6.3, 7.5_
  
  - [x] 3.2 Implement SelectItem component
    - Wrap SelectPrimitive.Item with forwardRef
    - Add SelectItemText and SelectItemIndicator (check icon from lucide-react)
    - Apply hover and focus styles using Tailwind
    - Support disabled state styling
    - _Requirements: 2.4, 2.6, 6.3, 6.4_
  
  - [x] 3.3 Implement SelectGroup and SelectLabel components
    - Wrap SelectPrimitive.Group and SelectPrimitive.Label
    - Apply appropriate spacing and text styles
    - _Requirements: 2.5_
  
  - [x] 3.4 Implement SelectScrollUpButton and SelectScrollDownButton
    - Wrap SelectPrimitive.ScrollUpButton and SelectPrimitive.ScrollDownButton
    - Add chevron icons from lucide-react
    - Apply appropriate positioning and styling
    - _Requirements: 2.4_
  
  - [ ]* 3.5 Write unit tests for Select component
    - Test rendering with default value
    - Test disabled state
    - Test placeholder display
    - Test SelectContent opens on trigger click
    - Test SelectItem selection updates value
    - _Requirements: 6.2, 6.4, 6.5_
  
  - [ ]* 3.6 Write property test for keyboard navigation
    - **Property 3: Keyboard navigation is functional**
    - **Validates: Requirements 4.1**
  
  - [ ]* 3.7 Write property test for ARIA attributes
    - **Property 4: ARIA attributes are present**
    - **Validates: Requirements 4.2**
  
  - [ ]* 3.8 Write property test for HTML attributes
    - **Property 9: HTML attributes are applied**
    - **Validates: Requirements 6.1**
  
  - [ ]* 3.9 Write property test for custom className
    - **Property 10: Custom className is applied**
    - **Validates: Requirements 6.3**

- [ ] 4. Checkpoint - Ensure Select component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Refactor VariableFillForm to use Select component
  - [x] 5.1 Update VariableFillForm imports
    - Import Select, SelectTrigger, SelectContent, SelectItem, SelectValue from ui/select
    - Remove native select element usage
    - _Requirements: 5.1_
  
  - [x] 5.2 Replace native select with Select component
    - Replace `<select>` with `<Select>` component
    - Replace `onChange` with `onValueChange` prop
    - Wrap trigger with SelectTrigger and SelectValue
    - Wrap options with SelectContent
    - Map options to SelectItem components
    - Preserve existing value and defaultValue logic
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 5.3 Write property test for VariableFillForm Select usage
    - **Property 5: VariableFillForm uses Select component**
    - **Validates: Requirements 5.1**
  
  - [ ]* 5.4 Write property test for default values
    - **Property 6: Default values are selected**
    - **Validates: Requirements 5.2**
  
  - [ ]* 5.5 Write property test for onChange handling
    - **Property 7: onChange handler is called**
    - **Validates: Requirements 5.3**
  
  - [ ]* 5.6 Write property test for all options rendered
    - **Property 8: All options are rendered**
    - **Validates: Requirements 5.4**
  
  - [ ]* 5.7 Write unit tests for VariableFillForm integration
    - Test form renders with dropdown variables
    - Test form handles empty options array
    - Test form preserves existing text/textarea inputs
    - Test API compatibility with existing props
    - _Requirements: 5.5_

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Select component follows shadcn/ui "new-york" style conventions
- All styling uses Tailwind CSS with CSS variable-based colors for theme support
- Property tests should run minimum 100 iterations each
- Each property test must include a comment tag: `// Feature: add-shadcn-select-component, Property N: [title]`
- The Select component is designed to be reusable throughout the application
- VariableFillForm maintains backward compatibility with its existing API
