# WebSocket Subscription Troubleshooting Guide

## Multiple Subscription Error

If you encounter the error: "Uncaught tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance", follow this guide to resolve the issue.

## Common Causes

1. **Component Re-renders**: Multiple subscription attempts due to unnecessary component re-renders
2. **Missing Cleanup**: Not cleaning up subscriptions when component unmounts
3. **Effect Dependencies**: Incorrect dependency array in useEffect hooks
4. **Race Conditions**: Multiple subscription attempts before previous ones are cleaned up

## Identifying the Issue

1. Check React DevTools for component re-render patterns
2. Look for useEffect hooks with subscription logic
3. Verify cleanup function implementation
4. Monitor network tab for multiple WebSocket connection attempts

## Best Practices

### 1. Single Subscription Pattern

```typescript
// ❌ Incorrect: No cleanup, potential multiple subscriptions
useEffect(() => {
  const channel = supabase
    .channel('room')
    .subscribe();
}, []);

// ✅ Correct: Single subscription with cleanup
useEffect(() => {
  const channel = supabase
    .channel('room')
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

### 2. Subscription Reference Management

```typescript
// ❌ Incorrect: No reference tracking
const [messages, setMessages] = useState([]);
useEffect(() => {
  supabase
    .channel('chat')
    .subscribe();
}, [messages]); // Dependency causes multiple subscriptions

// ✅ Correct: Using ref to track subscription
const subscriptionRef = useRef(null);
useEffect(() => {
  if (subscriptionRef.current) {
    subscriptionRef.current();
    subscriptionRef.current = null;
  }
  
  const channel = supabase
    .channel('chat')
    .subscribe();
    
  subscriptionRef.current = () => supabase.removeChannel(channel);
  
  return () => {
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }
  };
}, []); // No unnecessary dependencies
```

### 3. Component Mount State Tracking

```typescript
// ❌ Incorrect: No mount state tracking
useEffect(() => {
  const setup = async () => {
    const channel = supabase
      .channel('room')
      .subscribe();
  };
  setup();
}, []);

// ✅ Correct: Track mounted state
useEffect(() => {
  let isMounted = true;
  
  const setup = async () => {
    if (!isMounted) return;
    
    const channel = supabase
      .channel('room')
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  };
  
  const cleanup = setup();
  
  return () => {
    isMounted = false;
    cleanup?.();
  };
}, []);
```

## Implementation Example

Here's a complete example of proper subscription management:

```typescript
function Chat({ roomId }) {
  const subscriptionRef = useRef(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const initializeChat = async () => {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }

      try {
        const channel = supabase
          .channel(`room:${roomId}`)
          .on('INSERT', (payload) => {
            if (isMounted) {
              setMessages(prev => [...prev, payload.new]);
            }
          })
          .subscribe();

        // Store cleanup function
        subscriptionRef.current = () => {
          console.log('Cleaning up subscription');
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Subscription error:', error);
      }
    };

    initializeChat();

    // Cleanup on unmount or roomId change
    return () => {
      isMounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [roomId]);

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
    </div>
  );
}
```

## Checklist for Fixing Subscription Issues

1. ✅ Implement cleanup function in useEffect
2. ✅ Track subscription reference using useRef
3. ✅ Monitor component mounted state
4. ✅ Clean up on component unmount
5. ✅ Handle race conditions
6. ✅ Minimize effect dependencies
7. ✅ Add error handling
8. ✅ Log subscription lifecycle events

## Additional Tips

1. Use a subscription manager utility for complex applications
2. Implement retry logic with exponential backoff
3. Add logging for debugging subscription lifecycle
4. Consider using a state machine for connection management
5. Test subscription cleanup with component unmount scenarios

## Debugging Steps

1. Add console logs for subscription lifecycle:
   ```typescript
   const channel = supabase
     .channel('room')
     .subscribe((status) => {
       console.log('Subscription status:', status);
     });
   ```

2. Monitor cleanup execution:
   ```typescript
   return () => {
     console.log('Cleaning up subscription');
     supabase.removeChannel(channel);
   };
   ```

3. Track component lifecycle:
   ```typescript
   useEffect(() => {
     console.log('Component mounted');
     return () => console.log('Component unmounted');
   }, []);
   ```

Remember to remove debug logging in production code!