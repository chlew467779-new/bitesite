interface PageResult<Row> { data: Row[] | null; error: { message: string } | null }
interface PageQuery<Row> {
  order(column: string, options: { ascending: boolean }): PageQuery<Row>;
  range(from: number, to: number): PromiseLike<PageResult<Row>>;
}
export declare function selectAllPages<Row>(queryBuilderFactory: () => PageQuery<Row>): Promise<{ data: Row[]; error: null }>;
