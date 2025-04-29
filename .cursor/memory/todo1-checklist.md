# TODO 1: Dynamic Margin Reactivity Implementation Checklist

## Background
The goal is to enhance the bounding box to adapt dynamically to terminal resize events, allowing for responsive terminal UIs that reflow content gracefully.

## Implementation Steps

1. [ ] **Update BoundingBoxOptions interface**
   - [ ] Add `dynamicResize` option (accepts number for polling interval or 'SIGWINCH' string)
   ```typescript
   dynamicResize?: number | 'SIGWINCH'; // Use 'SIGWINCH' on Unix-like, number for polling interval
   ```
   - [ ] Add `resizeDebounceMs` option (for controlling debounce timeout)
   ```typescript
   resizeDebounceMs?: number; // Default: 100
   ```
   - [ ] Update JSDoc comments for new options

2. [ ] **Create resize detection helpers**
   - [ ] Add module-level variables for tracking state
   ```typescript
   let lastKnownWidth = Deno.consoleSize().columns;
   let debounceTimeout: number | undefined;
   ```
   - [ ] Implement debounced resize handler function
   ```typescript
   function handleResize(options: BoundingBoxOptions): void {
     const currentWidth = Deno.consoleSize().columns;
     if (currentWidth !== lastKnownWidth) {
       lastKnownWidth = currentWidth;
       // Trigger re-wrapping/re-rendering logic
     }
   }
   ```

3. [ ] **Implement platform-specific resize listeners**
   - [ ] Create SIGWINCH listener for Unix-like systems
   ```typescript
   function setupSigWinchListener(callback: () => void, debounceMs: number): void {
     Deno.addSignalListener("SIGWINCH", () => {
       clearTimeout(debounceTimeout);
       debounceTimeout = setTimeout(callback, debounceMs);
     });
   }
   ```
   - [ ] Create polling-based listener for cross-platform support
   ```typescript
   function setupPollingListener(callback: () => void, intervalMs: number): number {
     return setInterval(callback, intervalMs);
   }
   ```

4. [ ] **Create main setup function**
   - [ ] Implement `setupResizeListener` to choose the appropriate method
   ```typescript
   function setupResizeListener(options: BoundingBoxOptions, callback: () => void): () => void {
     const debounceMs = options.resizeDebounceMs ?? 100;
     
     if (options.dynamicResize === 'SIGWINCH' && Deno.build.os !== 'windows') {
       setupSigWinchListener(callback, debounceMs);
       return () => Deno.removeSignalListener("SIGWINCH", callback);
     } else if (typeof options.dynamicResize === 'number' && options.dynamicResize > 0) {
       const timerId = setupPollingListener(callback, options.dynamicResize);
       return () => clearInterval(timerId);
     }
     
     return () => {}; // No-op cleanup if no listeners set
   }
   ```

5. [ ] **Add reactive wrapper for main function**
   - [ ] Create `createDynamicBoundingBox` factory function
   ```typescript
   function createDynamicBoundingBox(text: string, options: BoundingBoxOptions = {}): {
     lines: string[];
     cleanup: () => void;
   } {
     let currentLines = wrapTextInBoundingBox(text, Deno.consoleSize().columns, options);
     
     const handleResize = () => {
       currentLines = wrapTextInBoundingBox(text, Deno.consoleSize().columns, options);
       // Return or notify about the updated lines
     };
     
     const cleanup = setupResizeListener(options, handleResize);
     
     return {
       lines: currentLines,
       cleanup,
     };
   }
   ```

6. [ ] **Add event-based API to allow re-rendering callbacks**
   - [ ] Create event emitter or callback system
   ```typescript
   function createReactiveBoundingBox(
     text: string, 
     options: BoundingBoxOptions = {}, 
     onResize?: (lines: string[]) => void
   ): {
     lines: string[];
     cleanup: () => void;
   } {
     // Implementation with callback on resize
   }
   ```

7. [ ] **Handle edge cases**
   - [ ] Add Windows-specific warning when SIGWINCH is requested
   - [ ] Implement cleanup function to remove listeners
   - [ ] Add safety check for Deno.build access

8. [ ] **Update exports**
   - [ ] Export new dynamic/reactive functions
   ```typescript
   export { 
     wrapTextInBoundingBox,
     createDynamicBoundingBox,
     createReactiveBoundingBox
   }
   ```

9. [ ] **Add comprehensive documentation**
   - [ ] Update module JSDoc comments
   - [ ] Add examples for reactive usage
   - [ ] Document platform-specific behavior

10. [ ] **Add tests**
    - [ ] Test resize handling logic
    - [ ] Test platform-specific behavior
    - [ ] Test cleanup functions
    - [ ] Test different configuration options

## Notes
- The implementation should gracefully degrade on platforms that don't support all features
- For Windows, polling is the only reliable method (no direct SIGWINCH equivalent)
- Consider memory usage and performance implications of different resize detection methods
- Make sure to provide proper cleanup functions to avoid memory leaks from lingering event listeners 
