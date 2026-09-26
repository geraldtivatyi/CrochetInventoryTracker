export default function Shop() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="font-poppins font-semibold text-xl mb-4">Shop</h2>
        <p className="text-neutral-600">Browse and purchase crochet items.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shop Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-medium text-lg mb-4">Available Products</h3>
            {/* Placeholder for shop items */}
            <p className="text-neutral-600">Shop items will be displayed here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
