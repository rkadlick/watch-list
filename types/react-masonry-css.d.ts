declare module 'react-masonry-css' {
  import { Component } from 'react';

  export interface MasonryProps {
    breakpointCols?: number | { [key: number]: number; default: number };
    className?: string;
    columnClassName?: string;
    children?: React.ReactNode;
  }

  export default class Masonry extends Component<MasonryProps> {}
}
