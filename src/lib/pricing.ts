export type PricedLine = {
  courseId: string;
  title: string;
  listPrice: number;
  payable: number;
  couponDiscount: number;
  net: number;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotal: number;
  couponDiscount: number;
  tax: number;
  total: number;
};

export function effectiveCoursePrice(course: {
  isFree: boolean;
  price: number;
  discountEnabled: boolean;
  discountedPrice: number;
}): number {
  if (course.isFree) return 0;
  if (course.discountEnabled && course.discountedPrice > 0) return course.discountedPrice;
  return course.price;
}

export function priceCart(
  courseRows: {
    id: string;
    title: string;
    isFree: boolean;
    price: number;
    discountEnabled: boolean;
    discountedPrice: number;
  }[],
  coupon: { discountPercentage: number } | null,
  taxPercent: number,
): PricedCart {
  const lines: PricedLine[] = courseRows.map((course) => {
    const payable = effectiveCoursePrice(course);
    const couponDiscount = coupon ? Math.floor((payable * coupon.discountPercentage) / 100) : 0;
    return {
      courseId: course.id,
      title: course.title,
      listPrice: course.isFree ? 0 : course.price,
      payable,
      couponDiscount,
      net: payable - couponDiscount,
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.listPrice, 0);
  const couponDiscountTotal = lines.reduce((sum, line) => sum + line.couponDiscount, 0);
  const taxable = lines.reduce((sum, line) => sum + line.net, 0);
  const tax = Math.floor((taxable * taxPercent) / 100);
  return { lines, subtotal, couponDiscount: couponDiscountTotal, tax, total: taxable + tax };
}

export function splitRevenue(net: number, instructorPercent: number) {
  const instructorRevenue = Math.floor((net * instructorPercent) / 100);
  return { instructorRevenue, adminRevenue: net - instructorRevenue };
}
