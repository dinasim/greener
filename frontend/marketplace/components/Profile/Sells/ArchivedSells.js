import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import DisabledCard from '../../components/DisabledProductCard/DisabledCard';
import { getUserArchivedSells } from '../../services/userData';

const ArchivedSells = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserArchivedSells()
      .then(res => {
        setProducts(res.sells || []);
        setLoading(false);
      })
      .catch(err => {
        console.log(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  const archived = products.filter(x => x.active === false);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Archive</Text>
      {archived.length > 0 ? (
        <FlatList
          data={archived}
          numColumns={2}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <DisabledCard params={item} />
            </View>
          )}
        />
      ) : (
        <Text style={styles.emptyText}>Nothing to show</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 16,
    fontFamily: 'serif'
  },
  cardWrapper: {
    flex: 1,
    padding: 8
  },
  loader: {
    flex: 1,
    justifyContent: 'center'
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#888',
    marginTop: 20
  }
});

export default ArchivedSells;
