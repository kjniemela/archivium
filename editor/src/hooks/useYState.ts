import { useY } from 'react-yjs';
import * as Y from 'yjs';

export function useYState<T>(yData: Y.Map<unknown>): [T, (newData: T) => void] {
  const data = useY(yData) as T;
  const setData = (newData: T) => {
    const newKeys: { [key: string]: true } = {};
    for (const key in newData) {
      yData.set(key, newData[key as keyof T]);
      newKeys[key] = true;
    }
    for (const key of yData.keys()) {
      if (!newKeys[key]) {
        yData.delete(key);
      }
    }
  }

  return [data, setData];
}
