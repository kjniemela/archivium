import { useY } from 'react-yjs';
import * as Y from 'yjs';

export function useYState<T>(yData: Y.Map<unknown>): [T, (newData: T) => void, (newData: Partial<T>) => void] {
  const data = useY(yData) as T;

  const changeData = (changes: Partial<T>) => {
    for (const key in changes) {
      yData.set(key, changes[key as keyof T]);
    }
  }

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

  return [data, setData, changeData];
}
